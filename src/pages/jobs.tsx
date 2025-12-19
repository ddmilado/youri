import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, getKeywordSearchResults, runAIWorkflow, getLeadResults } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Plus, Sparkles, ExternalLink, MapPin, MoreHorizontal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AIResultDialog } from '@/components/ai-result-dialog'
import { ErrorBoundary } from '@/components/error-boundary'
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
type LeadResult = Database['public']['Tables']['ai_lead_results']['Row']

function JobsPageContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'audits' | 'searches' | 'leads'>('leads')
  const [selectedLead, setSelectedLead] = useState<LeadResult | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['all-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const { data: keywordResults, isLoading: keywordLoading } = useQuery({
    queryKey: ['keyword-results', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getKeywordSearchResults(user.id)
    },
    enabled: !!user,
  })

  const { data: leadResults, isLoading: leadsLoading } = useQuery({
    queryKey: ['lead-results-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getLeadResults(user.id)
    },
    enabled: !!user,
  })

  const analyzeMutation = useMutation({
    mutationFn: async (result: KeywordResult) => {
      if (!user?.id) throw new Error('Not authenticated')
      const data = await runAIWorkflow(result.website, user.id)
      // Link the result to the job
      if (data?.job_id) {
        await linkAnalysis(result.id, data.job_id)
      }
      return data
    },
    onSuccess: () => {
      toast.success('Deep audit completed successfully!')
      queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
      queryClient.invalidateQueries({ queryKey: ['lead-results-history'] })
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis')
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200'
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'failed': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getQualityColor = (label: string | null) => {
    if (!label) return 'bg-gray-100 text-gray-700'
    if (label.includes('High')) return 'bg-green-100 text-green-700 border-green-200'
    if (label.includes('Medium')) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-orange-100 text-orange-700 border-orange-200'
  }

  const downloadPDF = async (job: Job) => {
    // Placeholder for PDF download logic
    toast.info(`Downloading PDF for audit: ${job.title}`)
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
        <div className="mb-6">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="leads" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="searches" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Keyword Searches
              </TabsTrigger>
              <TabsTrigger value="audits" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Site Audits
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {/* AI LEADS TABLE */}
            {activeTab === 'leads' && (
              <Table className="min-w-[700px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Company</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Localization</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                  ) : leadResults && leadResults.length > 0 ? (
                    leadResults.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedLead(lead)
                          setDetailsOpen(true)
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{lead.company}</div>
                          <div className="text-xs text-muted-foreground">{lead.website}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getQualityColor(lead.lead_quality_label)}>
                            {lead.lead_quality_score ?? '?'} - {lead.lead_quality_label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />
                            {lead.hq_location?.split(',')[0] || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.localization_evidence?.german_content_on_main_domain && (
                            <Badge variant="secondary" className="text-xs">
                              🇩🇪 Verified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No results found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {/* SEARCHES TABLE */}
            {activeTab === 'searches' && (
              <Table className="min-w-[800px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Company</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordLoading ? (
                    [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                  ) : keywordResults && keywordResults.length > 0 ? (
                    keywordResults.map((result) => (
                      <TableRow key={result.id}>
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
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No searches found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {/* AUDITS TABLE */}
            {activeTab === 'audits' && (
              <Table className="min-w-[600px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Audit Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsLoading ? (
                    [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>)
                  ) : jobs && jobs.length > 0 ? (
                    jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell className="text-muted-foreground">{job.url}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {job.report?.issuesCount || 0}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {job.status === 'completed' && (
                            <Button variant="ghost" size="sm" onClick={() => downloadPDF(job)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Link to={job.status === 'completed' ? `/report/${job.id}` : '#'}>
                            <Button variant="outline" size="sm">View Report</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No audits found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <AIResultDialog
          lead={selectedLead}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </div>
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
