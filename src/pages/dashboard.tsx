import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, TrendingUp, FileText, AlertCircle, Sparkles, ExternalLink, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type Database, getLeadResults } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

type Job = Database['public']['Tables']['jobs']['Row']
type LeadResult = Database['public']['Tables']['ai_lead_results']['Row']

const getIssueCount = (job: Job) => job.report?.issues?.length ?? job.report?.issuesCount ?? 0
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

export function DashboardPage() {
  const { user } = useAuth()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(5)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const { data: leadResults, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['leadResults', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getLeadResults(user.id)
    },
    enabled: !!user,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', user?.id],
    queryFn: async () => {
      const { data: allJobs, error } = await supabase.from('jobs').select('*').eq('user_id', user?.id)
      if (error) throw error
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const thisWeek = allJobs.filter((job) => new Date(job.created_at) >= weekAgo)
      const completed = allJobs.filter((job) => job.status === 'completed')
      const totalIssues = completed.reduce((sum, job) => sum + getIssueCount(job), 0)

      // Lead stats
      const totalLeads = leadResults?.length || 0

      return {
        total: allJobs.length,
        thisWeek: thisWeek.length,
        avgIssues: completed.length > 0 ? Math.round(totalIssues / completed.length) : 0,
        totalLeads
      }
    },
    enabled: !!user,
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-lg">Discover high-quality leads with AI-powered analysis</p>
      </div>

      <div className="mb-8">
        <Link to="/new">
          <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            <Sparkles className="mr-2 h-5 w-5" />
            New AI Lead Analysis
          </Button>
        </Link>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Audits', icon: FileText, value: stats?.total || 0, desc: 'All time' },
          { title: 'This Week', icon: TrendingUp, value: stats?.thisWeek || 0, desc: 'Audits completed' },
          { title: 'Avg. Issues', icon: AlertCircle, value: stats?.avgIssues || 0, desc: 'Per audit' },
          { title: 'AI Leads', icon: Building2, value: stats?.totalLeads || 0, desc: 'Generated', gradient: true }
        ].map((stat, i) => (
          <Card key={i} className={stat.gradient ? 'border-purple-200 dark:border-purple-800' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.gradient ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className={`text-3xl font-bold ${stat.gradient ? 'bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent' : ''}`}>{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* AI Lead Results Section */}
      <Card className="mb-8 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle>AI Lead Analysis Results</CardTitle>
          </div>
          <CardDescription>AI-generated German market opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLeads ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : leadResults && leadResults.length > 0 ? (
            <div className="space-y-4">
              {leadResults.slice(0, 5).map((lead) => (
                <div key={lead.id} className="p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{lead.company}</h3>
                        <Badge className={getQualityColor(lead.lead_quality_label)}>
                          {lead.lead_quality_label || 'Unscored'}
                        </Badge>
                        {lead.lead_quality_score !== null && (
                          <span className="text-sm text-muted-foreground">
                            Score: {lead.lead_quality_score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {lead.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {lead.industry && (
                        <p className="text-sm text-muted-foreground mb-1">Industry: {lead.industry}</p>
                      )}
                      {lead.markets && (
                        <p className="text-sm text-muted-foreground mb-1">Markets: {lead.markets}</p>
                      )}
                      {lead.localization_evidence?.german_content_on_main_domain && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          🇩🇪 German Content Available
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {lead.contacts && lead.contacts.length > 0 && (
                      <div className="ml-4 text-right">
                        <div className="text-xl font-bold">{lead.contacts.length}</div>
                        <div className="text-xs text-muted-foreground">contacts</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="mx-auto h-12 w-12 text-purple-400 mb-4" />
              <p className="text-muted-foreground mb-4">No AI leads generated yet</p>
              <Link to="/new">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate your first lead
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Traditional Audits Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Audits</CardTitle>
          <CardDescription>Your latest site inspections</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => {
                const issueCount = getIssueCount(job)
                return (
                  <Link key={job.id} to={job.status === 'completed' ? `/report/${job.id}` : '#'} className="block">
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium truncate">{job.title}</h3>
                          <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{job.url}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {job.status === 'completed' && issueCount > 0 && (
                        <div className="ml-4 text-right">
                          <div className="text-2xl font-bold">{issueCount}</div>
                          <div className="text-xs text-muted-foreground">issues</div>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No audits yet</p>
              <Link to="/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first audit
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
