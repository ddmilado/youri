import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, TrendingUp, Users, ExternalLink, Filter, Download, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, getLeadResults } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatDistanceToNow } from 'date-fns'
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
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const ScoreBadge = ({ score }: { score: number | null, label: string | null }) => {
  if (score === null) return <span className="text-muted-foreground">-</span>

  let colorClass = "text-gray-600 bg-gray-100"
  if (score >= 80) colorClass = "text-green-700 bg-green-50 border-green-200"
  else if (score >= 50) colorClass = "text-yellow-700 bg-yellow-50 border-yellow-200"
  else colorClass = "text-red-700 bg-red-50 border-red-200"


  return (
    <div className={`flex items-center gap-2 px-2.5 py-0.5 rounded-full border w-fit ${colorClass}`}>
      <span className="font-semibold text-xs">{score}</span>
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = "text-gray-600 bg-gray-100 border-gray-200"
  if (status === 'completed') colorClass = "text-green-700 bg-green-50 border-green-200"
  else if (status === 'processing') colorClass = "text-blue-700 bg-blue-50 border-blue-200"
  else if (status === 'failed') colorClass = "text-red-700 bg-red-50 border-red-200"

  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className={`flex items-center gap-2 px-2.5 py-0.5 rounded-full border w-fit ${colorClass}`}>
      <span className="font-semibold text-xs">{label}</span>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] || ''

  // Fetch recent jobs (Audits)
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Fetch AI Leads
  const { data: leadResults, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['leadResults', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getLeadResults(user.id)
    },
    enabled: !!user,
  })

  const stats = {
    totalLeads: leadResults?.length || 0,
    activeAudits: jobs?.filter(j => j.status === 'processing').length || 0,
    completedAudits: jobs?.filter(j => j.status === 'completed').length || 0
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Header - SaaS Style */}
      <header className="flex h-16 items-center flex-shrink-0 gap-4 border-b bg-background px-6 shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold md:text-xl">Dashboard</h1>
          <p className="text-xs text-muted-foreground hidden md:block">
            Welcome back, {firstName}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link to="/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              New Analysis
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-auto p-6">
        {/* KPI Cards - Dense Row */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3 mb-6">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground mt-1">Qualified opportunities</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Audits</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeAudits}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <TrendingUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completedAudits}</div>
              <p className="text-xs text-muted-foreground mt-1">Finished audits</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Data View - Tabs for Leads vs Audits */}
        <Tabs defaultValue="leads" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="leads">AI Leads</TabsTrigger>
              <TabsTrigger value="audits">Recent Audits</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="leads" className="m-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLeads ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : leadResults && leadResults.length > 0 ? (
                      leadResults.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div className="font-medium">{lead.company}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                {lead.website.replace('https://', '').replace('http://', '').split('/')[0]}
                                <ExternalLink className="h-2 w-2" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>{lead.industry || '-'}</TableCell>
                          <TableCell>
                            <ScoreBadge score={lead.lead_quality_score} label={lead.lead_quality_label} />
                          </TableCell>
                          <TableCell>
                            {lead.contacts && lead.contacts.length > 0 ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                {lead.contacts.length}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.localization_evidence?.german_content_on_main_domain ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                🇩🇪 Verified
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Unverified</span>
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
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No leads found. Start a new analysis.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audits" className="m-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audit Title</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingJobs ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : jobs && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground">{job.url}</TableCell>
                          <TableCell>
                            <StatusBadge status={job.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={job.status === 'completed' ? `/report/${job.id}` : '#'}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No audits found. Create your first one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  )
}
