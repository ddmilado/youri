import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, TrendingUp, FileText, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

type Job = Database['public']['Tables']['jobs']['Row']

const getIssueCount = (job: Job) => job.report?.issues?.length ?? job.report?.issuesCount ?? 0
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-500/10 text-green-500'
    case 'processing': return 'bg-blue-500/10 text-blue-500'
    case 'failed': return 'bg-red-500/10 text-red-500'
    default: return 'bg-gray-500/10 text-gray-500'
  }
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
      return { total: allJobs.length, thisWeek: thisWeek.length, avgIssues: completed.length > 0 ? Math.round(totalIssues / completed.length) : 0 }
    },
    enabled: !!user,
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-lg">Ready to audit your websites?</p>
      </div>

      <div className="mb-8">
        <Link to="/new">
          <Button size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            New Audit
          </Button>
        </Link>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: 'Total Audits', icon: FileText, value: stats?.total || 0, desc: 'All time' },
          { title: 'This Week', icon: TrendingUp, value: stats?.thisWeek || 0, desc: 'Audits completed' },
          { title: 'Avg. Issues', icon: AlertCircle, value: stats?.avgIssues || 0, desc: 'Per audit' }
        ].map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>

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
