import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, getKeywordSearchResults, runAIWorkflow, getLeadResults } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileText, Plus, Search, Sparkles, ExternalLink, Building2, MapPin, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { AIResultDialog } from '@/components/ai-result-dialog'
import { ErrorBoundary } from '@/components/error-boundary'

type Job = Database['public']['Tables']['jobs']['Row']
type KeywordResult = Database['public']['Tables']['keyword_search_results']['Row']
type LeadResult = Database['public']['Tables']['ai_lead_results']['Row']
type Issue = NonNullable<Job['report']>['issues'][number]

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
      return await runAIWorkflow(result.website, user.id)
    },
    onSuccess: () => {
      toast.success('Deep analysis started!')
      queryClient.invalidateQueries({ queryKey: ['keyword-results'] })
      queryClient.invalidateQueries({ queryKey: ['lead-results-history'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis')
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500'
      case 'processing': return 'bg-blue-500/10 text-blue-500'
      case 'failed': return 'bg-red-500/10 text-red-500'
      default: return 'bg-gray-500/10 text-gray-500'
    }
  }

  const getQualityColor = (label: string | null) => {
    if (!label) return 'bg-gray-500/10 text-gray-500'
    if (label.includes('High')) return 'bg-green-500/10 text-green-500'
    if (label.includes('Medium')) return 'bg-yellow-500/10 text-yellow-500'
    return 'bg-orange-500/10 text-orange-500'
  }

  const downloadPDF = async (job: Job) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const margin = 20

      pdf.setFontSize(24)
      pdf.text('SiteAudit Report', margin, margin)
      pdf.setFontSize(12)
      pdf.text(job.title, margin, margin + 10)
      pdf.setTextColor(100)
      pdf.text(job.url, margin, margin + 17)
      pdf.setTextColor(0)
      pdf.setFontSize(10)
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, margin + 24)

      if (job.report?.issues) {
        pdf.addPage()
        pdf.setFontSize(16)
        pdf.text('Issues Found', margin, margin)
        let yPos = margin + 10
        job.report.issues.forEach((issue, index) => {
          if (yPos > 270) { pdf.addPage(); yPos = margin }
          pdf.setFontSize(12)
          pdf.text(`${index + 1}. ${issue.title || issue.type}`, margin, yPos)
          yPos += 7
          pdf.setFontSize(10)
          pdf.setTextColor(100)
          const desc = issue.description || issue.message || 'No description'
          const lines = pdf.splitTextToSize(desc, 170)
          lines.forEach((line: string) => {
            if (yPos > 270) { pdf.addPage(); yPos = margin }
            pdf.text(line, margin, yPos)
            yPos += 7
          })
          pdf.setTextColor(0)
          yPos += 3
        })
      }

      pdf.save(`siteaudit-${job.id}.pdf`)
      toast.success('PDF downloaded!')
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  const downloadExcel = (job: Job) => {
    try {
      const issues = job.report?.issues || []
      const data = issues.map((issue: Issue, index: number) => ({
        '#': index + 1,
        'Issue': issue.title || issue.type,
        'Severity': issue.severity || 'N/A',
        'Description': issue.description || issue.message || 'No description',
        'Element': issue.element || 'N/A',
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Issues')
      ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 50 }, { wch: 30 }]
      XLSX.writeFile(wb, `siteaudit-${job.id}.xlsx`)
      toast.success('Excel downloaded!')
    } catch {
      toast.error('Failed to download Excel')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Audit Results</h1>
        <p className="text-muted-foreground text-lg">View all your searches, analyses, and audits</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg max-w-2xl p-1 gap-1 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex-1 min-w-[120px] py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm font-medium ${activeTab === 'leads'
            ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
            : 'hover:bg-white/50 dark:hover:bg-gray-800/50 text-muted-foreground'
            }`}
        >
          <Sparkles className="h-4 w-4" />
          AI Analysis (Deep)
        </button>
        <button
          onClick={() => setActiveTab('searches')}
          className={`flex-1 min-w-[120px] py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm font-medium ${activeTab === 'searches'
            ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
            : 'hover:bg-white/50 dark:hover:bg-gray-800/50 text-muted-foreground'
            }`}
        >
          <Search className="h-4 w-4" />
          Keyword Searches
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`flex-1 min-w-[120px] py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm font-medium ${activeTab === 'audits'
            ? 'bg-white dark:bg-gray-800 shadow-sm text-primary'
            : 'hover:bg-white/50 dark:hover:bg-gray-800/50 text-muted-foreground'
            }`}
        >
          <FileText className="h-4 w-4" />
          Site Audits
        </button>
      </div>

      {/* AI Lead Results */}
      {activeTab === 'leads' && (
        <>
          {leadsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : leadResults && leadResults.length > 0 ? (
            <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {leadResults.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedLead(lead)
                    setDetailsOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <Card className="h-full flex flex-col hover:shadow-lg transition-all hover:-translate-y-1 border-purple-200 dark:border-purple-900 group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg line-clamp-1 group-hover:text-purple-600 transition-colors">{lead.company}</CardTitle>
                        <Badge className={getQualityColor(lead.lead_quality_label)}>
                          {lead.lead_quality_score ?? '?'}
                        </Badge>
                      </div>
                      <div
                        className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {lead.industry && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {lead.industry}
                          </Badge>
                        )}
                        {lead.hq_location && (
                          <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {lead.hq_location.split(',')[0]}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end pt-0">
                      <div className="text-xs text-muted-foreground mt-4 flex items-center justify-between">
                        <span>
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </span>
                        {lead.localization_evidence?.german_content_on_main_domain && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-500 font-medium">
                            🇩🇪 Verified
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Sparkles className="h-16 w-16 text-purple-200 mb-6" />
                <h3 className="text-xl font-semibold mb-2">No AI Analyses Yet</h3>
                <p className="text-muted-foreground mb-8 text-center max-w-md">
                  Run a deep AI analysis on a company to see detailed insights about their tech stack, localization, and market fit.
                </p>
                <Link to="/new">
                  <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600">
                    <Plus className="mr-2 h-5 w-5" />
                    Start New Analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Keyword Search Results */}
      {activeTab === 'searches' && (
        <>
          {keywordLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : keywordResults && keywordResults.length > 0 ? (
            <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {keywordResults.map((result, index) => (
                <motion.div key={result.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg line-clamp-1">{result.company_name}</CardTitle>
                        {result.analyzed && (
                          <Badge className="bg-green-500/10 text-green-500">Analyzed</Badge>
                        )}
                      </div>
                      <a
                        href={result.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {result.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {result.company_description || 'No description available'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end">
                      {!result.analyzed ? (
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          onClick={() => analyzeMutation.mutate(result)}
                          disabled={analyzeMutation.isPending}
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          Analyze This
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Already Analyzed
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No searches yet</p>
                <p className="text-sm text-muted-foreground mb-6">Run a keyword search to discover companies</p>
                <Link to="/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Audit Jobs */}
      {activeTab === 'audits' && (
        <>
          {jobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {jobs.map((job, index) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
                        <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                      </div>
                      <CardDescription className="line-clamp-1">{job.url}</CardDescription>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end space-y-3">
                      {job.status === 'completed' && job.report?.issuesCount !== undefined && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span className="text-sm font-medium">Issues Found</span>
                          <span className="text-2xl font-bold">{job.report.issuesCount}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {job.status === 'completed' && (
                          <>
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadPDF(job)}>
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadExcel(job)}>
                              <Download className="h-4 w-4 mr-1" />
                              Excel
                            </Button>
                          </>
                        )}
                        <Link to={`/report/${job.id}`} className={job.status === 'completed' ? '' : 'flex-1'}>
                          <Button variant={job.status === 'completed' ? 'outline' : 'default'} size="sm" className="w-full">
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No audits yet</p>
                <p className="text-sm text-muted-foreground mb-6">Create your first audit to get started</p>
                <Link to="/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Audit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <AIResultDialog
        lead={selectedLead}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
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
