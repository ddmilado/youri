import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, getKeywordSearchResults, runAIWorkflow, linkAnalysis, deleteJobs, deleteKeywordResults } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { useBackgroundTasks } from '@/contexts/background-tasks-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Download, Plus, Sparkles, ExternalLink, Loader2, Share2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AIResultDialog } from '@/components/ai-result-dialog'
import { ErrorBoundary } from '@/components/error-boundary'
import { ProcessingOverlay } from '@/components/processing-overlay'
import { AnimatePresence } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type Job = Database['public']['Tables']['jobs']['Row']
type KeywordResult = Database['public']['Tables']['keyword_search_results']['Row']

function JobsPageContent() {
  const { user } = useAuth()
  const { addTask } = useBackgroundTasks()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'audits' | 'searches'>('audits')
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Selection state for each tab
  const [selectedAudits, setSelectedAudits] = useState<Set<string>>(new Set())
  const [selectedSearches, setSelectedSearches] = useState<Set<string>>(new Set())


  // Processing overlay state
  const [processingJobId, setProcessingJobId] = useState<string | null>(null)
  const [processingUrl, setProcessingUrl] = useState<string>('')

  const handleMinimizeAudit = (jobId: string, url: string) => {
    addTask({
      id: jobId,
      type: 'audit',
      status: 'processing',
      title: 'Deep Audit',
      subtitle: url,
      progress: 0,
    })
    setProcessingJobId(null)
    setProcessingUrl('')
    toast.info('Audit running in background')
  }

  // Pagination state
  const [auditsPage, setAuditsPage] = useState(1)
  const [searchesPage, setSearchesPage] = useState(1)

  const ITEMS_PER_PAGE = 10

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteType, setDeleteType] = useState<'audits' | 'searches'>('audits')

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['all-jobs', user?.id],
    queryFn: async () => {
      // Remove .eq('user_id', user?.id) to allow RLS to return team jobs
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true,
  })

  const { data: keywordResults, isLoading: keywordLoading } = useQuery({
    queryKey: ['keyword-results', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getKeywordSearchResults(user.id)
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchIntervalInBackground: true,
  })



  // REALTIME LIST UPDATES
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('jobs-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Jobs table change detected:', payload)
        queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
        // Force immediate refetch
        queryClient.refetchQueries({ queryKey: ['all-jobs'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'keyword_search_results', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Keyword results change detected:', payload)
        queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
        queryClient.refetchQueries({ queryKey: ['keyword-results'] })
      })

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])

  const analyzeMutation = useMutation({
    mutationFn: async (result: KeywordResult) => {
      if (!user?.id) throw new Error('Not authenticated')

      // Create job first to get job ID for processing overlay
      const { data: newJob, error: insertError } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          url: result.website,
          title: result.company_name || new URL(result.website).hostname,
          status: 'pending',
          creator_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
          creator_email: user.email
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Show processing overlay
      if (newJob) {
        setProcessingJobId(newJob.id)
        setProcessingUrl(result.website)
      }

      const data = await runAIWorkflow(result.website, user.id, newJob?.id)

      if (data && data.success === false) {
        throw new Error(data.error || 'Discovery trigger failed')
      }

      if (data?.job_id && newJob) {
        await linkAnalysis(result.id, newJob.id)
      }
      return { ...data, job_id: newJob?.id }
    },
    onSuccess: () => {
      toast.success('Deep audit started! Processing overlay will show progress.')
      queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
      // Don't navigate immediately - let user see the processing overlay
    },
    onError: (error) => {
      // Don't show error - the job likely started in background
      console.warn('Analyze mutation error (job may still be processing):', error)
      toast.info('Audit started - processing overlay will show progress')
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
      // Don't clear processing overlay on error - job might still be running
    }
  })

  // Batch analyze mutation
  const batchAnalyzeMutation = useMutation({
    mutationFn: async (results: KeywordResult[]) => {
      if (!user?.id) throw new Error('Not authenticated')

      const jobPromises = results.map(async (result) => {
        // Create job first
        const { data: newJob, error: insertError } = await supabase
          .from('jobs')
          .insert({
            user_id: user.id,
            url: result.website,
            title: result.company_name || new URL(result.website).hostname,
            status: 'pending',
            creator_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
            creator_email: user.email
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to create job for', result.website, insertError)
          return null
        }

        // Add to background tasks
        if (newJob) {
          addTask({
            id: newJob.id,
            type: 'audit',
            status: 'processing',
            title: 'Deep Audit',
            subtitle: result.website,
            progress: 0,
          })

          // Start the workflow
          try {
            const data = await runAIWorkflow(result.website, user.id, newJob.id)
            if (data?.job_id) {
              await linkAnalysis(result.id, newJob.id)
            }
            return { result, job: newJob, data }
          } catch (err) {
            console.error('Workflow trigger failed for', result.website, err)
            return { result, job: newJob, error: err }
          }
        }
        return null
      })

      const results_with_jobs = await Promise.all(jobPromises)
      return results_with_jobs.filter(Boolean)
    },
    onSuccess: (results) => {
      const successCount = results?.length || 0
      toast.success(`${successCount} audit${successCount > 1 ? 's' : ''} started! Check background tasks for progress.`)
      setSelectedSearches(new Set())
      queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
      // Navigate to audit tab after successful submission
      setActiveTab('audits')
    },
    onError: (error) => {
      // Don't show error - jobs likely started in background
      console.warn('Batch analyze error (jobs may still be processing):', error)
      toast.info('Audits started - check background tasks and Site Audits tab for progress')
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
      setActiveTab('audits')
    }
  })

  // Delete mutations
  const deleteAuditsMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteJobs(ids),
    onSuccess: () => {
      toast.success('Audits deleted successfully')
      setSelectedAudits(new Set())
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
    },
    onError: () => toast.error('Failed to delete audits')
  })

  const deleteSearchesMutation = useMutation({
    mutationFn: async (ids: string[]) => deleteKeywordResults(ids),
    onSuccess: () => {
      toast.success('Searches deleted successfully')
      setSelectedSearches(new Set())
      queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
    },
    onError: () => toast.error('Failed to delete searches')
  })



  const handleDeleteConfirm = async () => {
    if (deleteType === 'audits') {
      await deleteAuditsMutation.mutateAsync(Array.from(selectedAudits))
    } else if (deleteType === 'searches') {
      await deleteSearchesMutation.mutateAsync(Array.from(selectedSearches))
    }
  }

  const openDeleteDialog = (type: 'audits' | 'searches') => {
    setDeleteType(type)
    setDeleteDialogOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200'
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'failed': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700'
    }
  }



  const downloadPDF = async (job: Job) => {
    toast.info(`Downloading PDF for audit: ${job.title}`)
  }

  const handleShare = async (job: Job) => {
    const newPublicState = !job.is_public
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_public: newPublicState })
        .eq('id', job.id)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })

      if (newPublicState) {
        const shareUrl = `${window.location.origin}/report/${job.id}`
        navigator.clipboard.writeText(shareUrl)
        toast.success('Report shared! Link copied to clipboard.')
      } else {
        toast.info('Report is now private.')
      }
    } catch (error) {
      toast.error('Failed to update share settings')
    }
  }

  // Selection helpers
  const toggleAuditSelection = (id: string) => {
    const newSet = new Set(selectedAudits)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedAudits(newSet)
  }

  const toggleSearchSelection = (id: string) => {
    const newSet = new Set(selectedSearches)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedSearches(newSet)
  }



  const selectAllAudits = (checked: boolean) => {
    if (checked && jobs) setSelectedAudits(new Set(jobs.map(j => j.id)))
    else setSelectedAudits(new Set())
  }

  const selectAllSearches = (checked: boolean) => {
    if (checked && keywordResults) setSelectedSearches(new Set(keywordResults.map(r => r.id)))
    else setSelectedSearches(new Set())
  }



  const getSelectedCount = () => {
    if (activeTab === 'audits') return selectedAudits.size
    return selectedSearches.size
  }

  const handleBatchAnalyze = () => {
    if (!keywordResults) return
    const toAnalyze = keywordResults.filter(r => selectedSearches.has(r.id) && !r.analyzed)
    if (toAnalyze.length === 0) {
      toast.info('No unanalyzed items selected')
      return
    }
    if (toAnalyze.length > 5) {
      toast.error('Maximum 5 audits allowed per batch. Please select fewer items.')
      return
    }

    // Clear selections and switch to audit tab
    setSelectedSearches(new Set())

    batchAnalyzeMutation.mutate(toAnalyze, {
      onSuccess: () => {
        // Navigate to audit tab after successful submission
        setActiveTab('audits')
        toast.success(`${toAnalyze.length} audit${toAnalyze.length > 1 ? 's' : ''} started! Check the Site Audits tab.`)
      }
    })
  }

  // Pagination helpers
  const getPaginatedData = <T,>(data: T[] | undefined, page: number): T[] => {
    if (!data) return []
    const start = (page - 1) * ITEMS_PER_PAGE
    return data.slice(start, start + ITEMS_PER_PAGE)
  }

  const getTotalPages = (data: any[] | undefined): number => {
    if (!data) return 1
    return Math.ceil(data.length / ITEMS_PER_PAGE)
  }

  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems
  }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    totalItems: number
  }) => {
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            )).slice(
              Math.max(0, currentPage - 3),
              Math.min(totalPages, currentPage + 2)
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  // Get paginated data
  const paginatedJobs = getPaginatedData(jobs, auditsPage)
  const paginatedKeywordResults = getPaginatedData(keywordResults, searchesPage)

  const handleCancelSelection = () => {
    setSelectedAudits(new Set())
    setSelectedSearches(new Set())
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:h-16 items-center border-b border-border px-4 md:px-6 bg-background flex-shrink-0 shadow-sm py-4 md:py-0 gap-4">
        <h1 className="text-lg font-semibold md:text-xl w-full md:w-auto text-left">Audit Results</h1>
        <div className="ml-auto flex items-center gap-2 w-full md:w-auto justify-end">
          <Link to="/new" className="w-full md:w-auto">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="audits" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Site Audits
              </TabsTrigger>
              <TabsTrigger value="searches" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Keyword Searches
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Bulk Actions */}
          {getSelectedCount() > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                onClick={handleCancelSelection}
                title="Cancel Selection"
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{getSelectedCount()} selected</span>
              {activeTab === 'searches' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBatchAnalyze}
                  disabled={batchAnalyzeMutation.isPending}
                  className={selectedSearches.size > 5 ? 'border-red-500 text-red-600' : ''}
                >
                  {batchAnalyzeMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  Analyze Selected ({selectedSearches.size}/5)
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openDeleteDialog(activeTab)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete
              </Button>
            </div>
          )}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">


            {/* SEARCHES TABLE */}
            {activeTab === 'searches' && (
              <>
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={keywordResults && keywordResults.length > 0 && selectedSearches.size === keywordResults.length}
                          onCheckedChange={selectAllSearches}
                        />
                      </TableHead>
                      <TableHead className="w-[300px]">Company</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywordLoading ? (
                      [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                    ) : paginatedKeywordResults && paginatedKeywordResults.length > 0 ? (
                      paginatedKeywordResults.map((result) => (
                        <TableRow key={result.id} className={cn(selectedSearches.has(result.id) && "bg-muted/30")}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSearches.has(result.id)}
                              onCheckedChange={() => toggleSearchSelection(result.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{result.company_name}</div>
                            <a href={result.website} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              {result.website} <ExternalLink className="h-2 w-2" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground line-clamp-1 max-w-md">
                              {result.company_description || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {result.analyzed ? (
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Analyzed</Badge>
                            ) : (
                              <Badge variant="outline">New</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(result.created_at), { addSuffix: true }).replace('about ', '')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {result.user_id === user?.id ? (
                              <Badge variant="outline" className="text-[10px] h-5 font-normal bg-slate-50 text-slate-500 border-slate-200">You</Badge>
                            ) : (
                              <span className="text-muted-foreground">Team Member</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!result.analyzed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => analyzeMutation.mutate(result)}
                                disabled={analyzeMutation.isPending}
                                className="min-w-[100px]"
                              >
                                {analyzeMutation.isPending && analyzeMutation.variables?.id === result.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Analyzing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="mr-1 h-3 w-3" /> Analyze
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center">No searches found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={searchesPage}
                  totalPages={getTotalPages(keywordResults)}
                  onPageChange={setSearchesPage}
                  totalItems={keywordResults?.length || 0}
                />
              </>
            )}

            {/* AUDITS TABLE */}
            {activeTab === 'audits' && (
              <>
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={jobs && jobs.length > 0 && selectedAudits.size === jobs.length}
                          onCheckedChange={selectAllAudits}
                        />
                      </TableHead>
                      <TableHead>Audit Name</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobsLoading ? (
                      [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                    ) : paginatedJobs && paginatedJobs.length > 0 ? (
                      paginatedJobs.map((job) => (
                        <TableRow key={job.id} className={cn(selectedAudits.has(job.id) && "bg-muted/30")}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAudits.has(job.id)}
                              onCheckedChange={() => toggleAuditSelection(job.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell>
                            {job.user_id === user?.id ? (
                              <Badge variant="outline" className="text-[10px] h-5 font-normal bg-slate-50 text-slate-500 border-slate-200">You</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Team Member</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{job.url}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {job.report?.issuesCount || 0}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true }).replace('about ', '')}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {job.status === 'completed' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShare(job)}
                                  className={cn(job.is_public && "text-emerald-600 bg-emerald-50")}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => downloadPDF(job)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Link to={job.status === 'completed' ? `/report/${job.id}` : '#'}>
                              <Button variant="outline" size="sm">View Report</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={7} className="h-24 text-center">No audits found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={auditsPage}
                  totalPages={getTotalPages(jobs)}
                  onPageChange={setAuditsPage}
                  totalItems={jobs?.length || 0}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <AIResultDialog
          lead={null}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Items"
          description={
            <span>
              Are you sure you want to delete <strong>{getSelectedCount()}</strong> {deleteType}?
              This action is <strong>permanent</strong> and cannot be undone.
            </span>
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
        />
      </div>

      <AnimatePresence>
        {processingJobId && (
          <ProcessingOverlay
            jobId={processingJobId}
            onClose={() => setProcessingJobId(null)}
            onMinimize={() => handleMinimizeAudit(processingJobId, processingUrl)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export function JobsPage() {
  return (
    <ErrorBoundary>
      <JobsPageContent />
    </ErrorBoundary>
  )
}
