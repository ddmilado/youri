import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, TrendingUp, Users, Filter, Download, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getLeadResults, getKeywordSearchResults, getRecentPeopleSearches, createLead } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatDistanceToNow } from 'date-fns'
import { Search as SearchIcon, History } from 'lucide-react'
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
  const queryClient = useQueryClient()
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Header - SaaS Style */}
      <header className="flex h-auto min-h-[4rem] items-center flex-shrink-0 gap-4 border-b bg-background px-4 md:px-6 py-4 shadow-sm flex-wrap">
        <div className="flex flex-col min-w-0 flex-1">
          <h1 className="text-lg font-semibold md:text-xl truncate">Dashboard</h1>
          <p className="text-xs text-muted-foreground hidden md:block truncate">
            Welcome back, {firstName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link to="/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap">
              <Plus className="mr-1 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
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

        {/* Main Data View - Tabs for Audits, Leads, and Searches */}
        <Tabs defaultValue="audits" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="audits">Recent Audits</TabsTrigger>
              <TabsTrigger value="searches">Searches</TabsTrigger>
            </TabsList>
          </div>



          <TabsContent value="audits" className="m-0">
            <Card className="overflow-hidden">
              {/* Batch Actions Toolbar */}
              {selectedJobIds.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 px-4 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between transition-all animate-in slide-in-from-top-2">
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
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
                      className="bg-emerald-600 text-white hover:bg-emerald-700 h-8"
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
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell className="text-muted-foreground">{job.url}</TableCell>
                          <TableCell>
                            <StatusBadge status={job.status} />
                          </TableCell>
                          <TableCell>
                            {job.user_id === user?.id ? (
                              <Badge variant="outline" className="text-[10px] h-5 font-normal bg-slate-50 text-slate-500 border-slate-200">You</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{job.creator_name || 'Team Member'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true }).replace('about ', '')}
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
                        <TableCell colSpan={7} className="h-24 text-center">
                          No audits found. Create your first one.
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
              {/* Keyword Searches Card */}
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-emerald-600" />
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
                          <div key={search.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors max-w-full overflow-hidden">
                            <div className="font-medium truncate" title={search.search_query}>{search.search_query}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[120px]">{search.company_name}</span>
                                <span className="text-[10px] opacity-50">•</span>
                                {search.user_id === user?.id ? (
                                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1 rounded">You</span>
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
                      <div className="p-8 text-center text-muted-foreground italic">No recent keyword searches</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* People Searches Card */}
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <SearchIcon className="h-5 w-5 text-emerald-600" />
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
                          <div key={search.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors max-w-full overflow-hidden">
                            <div className="font-medium truncate" title={search.query}>{search.query}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="whitespace-nowrap">{search.results?.length || 0} matches</span>
                              <span className="whitespace-nowrap opacity-70">{formatDistanceToNow(new Date(search.created_at), { addSuffix: true }).replace('about ', '')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground italic">No recent people searches</div>
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
