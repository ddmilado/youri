import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowUpRight, CheckCircle2, Clock3, Loader2, Plus, Search as SearchIcon, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, getLeadResults, getKeywordSearchResults, getRecentPeopleSearches, createLead } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatDistanceToNow } from 'date-fns'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
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


const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700"
  if (status === 'completed') colorClass = "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800"
  else if (status === 'processing') colorClass = "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800"
  else if (status === 'failed') colorClass = "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800"

  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border w-fit ${colorClass}`}>
      <span className="font-semibold text-xs">{label}</span>
    </div>
  )
}

const MetricCard = ({
  label,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  caption: string
  icon: typeof Users
  tone: string
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{caption}</p>
    </CardContent>
  </Card>
)

export function DashboardPage() {
  const { user } = useAuth()
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [isCreatingLeads, setIsCreatingLeads] = useState(false)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] || ''

  // Fetch recent jobs (Audits) - Removed user_id filter to show all accessible jobs (Team view)
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs', 'all'], // Changed queryKey to be broader
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20) // Increased limit slightly

      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Fetch AI Leads
  const { data: leadResults } = useQuery({
    queryKey: ['leadResults', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return await getLeadResults(user.id)
    },
    enabled: !!user,
  })

  // Fetch Keyword Searches
  const { data: keywordSearches, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ['keywordSearches', user?.id],
    queryFn: () => getKeywordSearchResults(user!.id),
    enabled: !!user?.id
  })

  // Fetch People Searches
  const { data: peopleSearches, isLoading: isLoadingPeople } = useQuery({
    queryKey: ['peopleSearches', user?.id],
    queryFn: () => getRecentPeopleSearches(user!.id),
    enabled: !!user?.id
  })

  const stats = {
    totalLeads: leadResults?.length || 0,
    activeAudits: jobs?.filter(j => j.status === 'processing').length || 0,
    completedAudits: jobs?.filter(j => j.status === 'completed').length || 0
  }

  const handleAddToLeads = async () => {
    if (!user || selectedJobIds.length === 0) return

    setIsCreatingLeads(true)
    try {
      const selectedJobs = jobs?.filter(j => selectedJobIds.includes(j.id)) || []

      let count = 0
      for (const job of selectedJobs) {
        // Basic company name extraction from title or URL
        const hostname = job.url.includes('://') ? new URL(job.url).hostname : job.url
        const companyName = job.title !== hostname ? job.title : hostname.replace('www.', '').split('.')[0]

        await createLead({
          job_id: job.id,
          url: job.url,
          title: job.title,
          status: 'new',
          created_by: user.id,
          creator_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          creator_email: user.email,
          company_name: companyName.charAt(0).toUpperCase() + companyName.slice(1) // Capitalize
        })
        count++
      }

      toast.success(`Successfully added ${count} lead${count !== 1 ? 's' : ''} to Leads`)
      setSelectedJobIds([])
      // Invalidate leads query if we had one here, but it's on a different page. 
      // We might want to prefetch?
    } catch (error) {
      console.error('Failed to create leads:', error)
      toast.error('Failed to add leads')
    } finally {
      setIsCreatingLeads(false)
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <main className="app-page">
        <header className="app-header">
          <div className="min-w-0">
            <p className="eyebrow">Command center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track audits, convert useful findings into leads, and keep an eye on team search activity.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link to="/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New Analysis
              </Button>
            </Link>
            <Link to="/jobs" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <History className="mr-2 h-4 w-4" />
                View Results
              </Button>
            </Link>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            label="Total Leads"
            value={stats.totalLeads}
            caption="Qualified opportunities in the pipeline"
            icon={Users}
            tone="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
          />
          <MetricCard
            label="Active Audits"
            value={stats.activeAudits}
            caption="Currently processing in the background"
            icon={Clock3}
            tone="bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
          />
          <MetricCard
            label="Completed"
            value={stats.completedAudits}
            caption="Finished audits ready for review"
            icon={CheckCircle2}
            tone="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          />
        </div>

        <Tabs defaultValue="audits" className="w-full">
          <div className="mb-4 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="audits">Recent Audits</TabsTrigger>
              <TabsTrigger value="searches">Searches</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="audits" className="m-0">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/80">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Audit Queue</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Latest site analyses from your workspace.</p>
                  </div>
                  <Badge variant="outline" className="w-fit">{jobs?.length || 0} visible</Badge>
                </div>
              </CardHeader>
              {selectedJobIds.length > 0 && (
                <div className="flex items-center justify-between border-b border-secondary/20 bg-secondary/10 p-3 px-4 transition-all animate-in slide-in-from-top-2">
                  <div className="text-sm font-semibold text-foreground">
                    {selectedJobIds.length} audit{selectedJobIds.length !== 1 && 's'} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedJobIds([])}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddToLeads}
                      disabled={isCreatingLeads}
                      className="h-8 bg-secondary text-white hover:bg-secondary/90"
                    >
                      {isCreatingLeads ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Users className="mr-2 h-3.5 w-3.5" />
                          Add to Leads
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={jobs && jobs.length > 0 && selectedJobIds.length === jobs.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedJobIds(jobs?.map(j => j.id) || [])
                            } else {
                              setSelectedJobIds([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Audit Title</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingJobs ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : jobs && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <TableRow key={job.id} className={selectedJobIds.includes(job.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedJobIds.includes(job.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedJobIds(prev => [...prev, job.id])
                                } else {
                                  setSelectedJobIds(prev => prev.filter(id => id !== job.id))
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="min-w-[180px] font-semibold">{job.title}</TableCell>
                          <TableCell className="max-w-[260px] truncate text-muted-foreground">{job.url}</TableCell>
                          <TableCell>
                            <StatusBadge status={job.status} />
                          </TableCell>
                          <TableCell>
                            {job.user_id === user?.id ? (
                              <Badge variant="outline" className="h-5 text-[10px] font-semibold">You</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{job.creator_name || 'Team Member'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true }).replace('about ', '')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={job.status === 'completed' ? `/report/${job.id}` : '#'}>
                              <Button variant="outline" size="sm">
                                View
                                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-36 text-center">
                          <div className="mx-auto max-w-sm">
                            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 font-semibold">No audits yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">Create your first analysis to start building a lead pipeline.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="searches" className="m-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-secondary" />
                    Keyword Searches
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="">
                    {isLoadingKeywords ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : keywordSearches && keywordSearches.length > 0 ? (
                      <div className="divide-y overflow-hidden">
                        {keywordSearches.slice(0, 5).map((search) => (
                          <div key={search.id} className="p-4 hover:bg-muted/45 transition-colors max-w-full overflow-hidden">
                            <div className="font-medium truncate" title={search.search_query}>{search.search_query}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[120px]">{search.company_name}</span>
                                <span className="text-[10px] opacity-50">•</span>
                                {search.user_id === user?.id ? (
                                  <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] font-semibold text-secondary">You</span>
                                ) : (
                                  <span className="text-[10px] opacity-70">Team Member</span>
                                )}
                              </div>
                              <span className="whitespace-nowrap opacity-70 text-[10px]">{formatDistanceToNow(new Date(search.created_at), { addSuffix: true }).replace('about ', '')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm text-muted-foreground">No recent keyword searches</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <SearchIcon className="h-5 w-5 text-secondary" />
                    People Searches
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="">
                    {isLoadingPeople ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : peopleSearches && peopleSearches.length > 0 ? (
                      <div className="divide-y overflow-hidden">
                        {peopleSearches.slice(0, 5).map((search) => (
                          <div key={search.id} className="p-4 hover:bg-muted/45 transition-colors max-w-full overflow-hidden">
                            <div className="font-medium truncate" title={search.query}>{search.query}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="whitespace-nowrap">{search.results?.length || 0} matches</span>
                              <span className="whitespace-nowrap opacity-70">{formatDistanceToNow(new Date(search.created_at), { addSuffix: true }).replace('about ', '')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm text-muted-foreground">No recent people searches</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
