import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileSearch,
  Globe2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import {
  createLead,
  getKeywordSearchResults,
  getLeadResults,
  getRecentPeopleSearches,
  supabase,
} from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const statusStyles: Record<string, string> = {
  completed: 'border-success/25 bg-success/10 text-success',
  processing: 'border-info/25 bg-info/10 text-info',
  failed: 'border-destructive/25 bg-destructive/10 text-destructive',
  pending: 'border-border bg-muted text-muted-foreground',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
        statusStyles[status] || statusStyles.pending
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [isCreatingLeads, setIsCreatingLeads] = useState(false)

  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    ''

  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const { data: leadResults } = useQuery({
    queryKey: ['leadResults', user?.id],
    queryFn: () => (user?.id ? getLeadResults(user.id) : Promise.resolve([])),
    enabled: !!user,
  })

  const { data: keywordSearches, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ['keywordSearches', user?.id],
    queryFn: () => getKeywordSearchResults(user!.id),
    enabled: !!user?.id,
  })

  const { data: peopleSearches, isLoading: isLoadingPeople } = useQuery({
    queryKey: ['peopleSearches', user?.id],
    queryFn: () => getRecentPeopleSearches(user!.id),
    enabled: !!user?.id,
  })

  const activeJobs = jobs?.filter((job) => job.status === 'processing') || []
  const completedJobs = jobs?.filter((job) => job.status === 'completed') || []
  const latestActive = activeJobs[0]
  const totalResearch = (jobs?.length || 0) + (keywordSearches?.length || 0)

  const handleAddToLeads = async () => {
    if (!user || selectedJobIds.length === 0) return
    setIsCreatingLeads(true)
    try {
      const selectedJobs = jobs?.filter((job) => selectedJobIds.includes(job.id)) || []
      for (const job of selectedJobs) {
        const hostname = job.url.includes('://') ? new URL(job.url).hostname : job.url
        const companyName =
          job.title !== hostname ? job.title : hostname.replace('www.', '').split('.')[0]
        await createLead({
          job_id: job.id,
          url: job.url,
          title: job.title,
          status: 'new',
          created_by: user.id,
          creator_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          creator_email: user.email,
          company_name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
        })
      }
      toast.success(`${selectedJobs.length} audit${selectedJobs.length === 1 ? '' : 's'} added to Leads`)
      setSelectedJobIds([])
    } catch (error) {
      console.error('Failed to create leads:', error)
      toast.error('Failed to add leads')
    } finally {
      setIsCreatingLeads(false)
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="app-page">
        <header className="app-header">
          <div className="min-w-0">
            <p className="eyebrow">Research overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] md:text-4xl">
              Good {getTimeOfDay()}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              See what your agents are investigating, review completed evidence, and turn useful findings into opportunities.
            </p>
          </div>
          <Button asChild>
            <Link to="/new">
              <Plus className="mr-2 h-4 w-4" />
              Start research
            </Link>
          </Button>
        </header>

        <section aria-label="Workspace summary" className="surface-panel mb-6 overflow-hidden">
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            <SummaryMetric label="Research runs" value={totalResearch} detail="Audits and keyword searches" />
            <SummaryMetric label="In progress" value={activeJobs.length} detail="Agent is actively browsing" tone="info" />
            <SummaryMetric label="Evidence ready" value={completedJobs.length} detail="Completed audit reports" tone="success" />
            <SummaryMetric label="Saved leads" value={leadResults?.length || 0} detail="Opportunities in your pipeline" />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <section className="surface-panel overflow-hidden" aria-labelledby="recent-research-heading">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Workspace activity</p>
                <h2 id="recent-research-heading" className="mt-1.5 text-lg font-bold tracking-tight">Recent research</h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/jobs">
                  View all results
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {selectedJobIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/[0.045] px-5 py-3">
                <span className="text-sm font-semibold">{selectedJobIds.length} selected</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedJobIds([])}>Clear</Button>
                  <Button size="sm" onClick={handleAddToLeads} disabled={isCreatingLeads}>
                    {isCreatingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                    Add to leads
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="Select all visible research"
                        checked={!!jobs?.length && selectedJobIds.length === jobs.length}
                        onCheckedChange={(checked) => setSelectedJobIds(checked ? jobs?.map((job) => job.id) || [] : [])}
                      />
                    </TableHead>
                    <TableHead>Research subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingJobs ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-9 w-64" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-9 w-9" /></TableCell>
                      </TableRow>
                    ))
                  ) : jobs?.length ? (
                    jobs.slice(0, 8).map((job) => (
                      <TableRow key={job.id} className={cn(selectedJobIds.includes(job.id) && 'bg-primary/[0.035]')}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Select ${job.title}`}
                            checked={selectedJobIds.includes(job.id)}
                            onCheckedChange={(checked) =>
                              setSelectedJobIds((current) =>
                                checked ? [...current, job.id] : current.filter((id) => id !== job.id)
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="truncate font-semibold">{job.title}</p>
                            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{job.url}</p>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={job.status} /></TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true }).replace('about ', '')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon-sm" disabled={job.status !== 'completed'}>
                            <Link to={job.status === 'completed' ? `/report/${job.id}` : '/jobs'} aria-label={`Open ${job.title}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-56 text-center">
                        <FileSearch className="mx-auto h-8 w-8 text-primary" />
                        <p className="mt-3 font-semibold">No research runs yet</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Give an agent a website or keyword brief to begin building your evidence library.</p>
                        <Button asChild size="sm" className="mt-4"><Link to="/new">Start first research</Link></Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="surface-panel overflow-hidden" aria-labelledby="agent-status-heading">
              <div className="border-b border-border px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Agent activity</p>
                    <h2 id="agent-status-heading" className="mt-1.5 text-lg font-bold tracking-tight">
                      {latestActive ? 'Browsing now' : 'Agent ready'}
                    </h2>
                  </div>
                  <span className={cn('h-2.5 w-2.5 rounded-full', latestActive ? 'animate-pulse bg-info' : 'bg-success')} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {latestActive ? latestActive.title : 'No active jobs. The agent is ready for a new research brief.'}
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="evidence-rail">
                  <EvidenceStep icon={Check} title="Brief received" detail="Scope and target understood" complete />
                  <EvidenceStep icon={latestActive ? Loader2 : Check} title="Browser session" detail={latestActive ? 'Navigating and collecting evidence' : 'Real browser available'} active={!!latestActive} complete={!latestActive} />
                  <EvidenceStep icon={latestActive ? Circle : Check} title="Evidence review" detail={latestActive ? 'Waiting for collected sources' : 'Verification pipeline ready'} complete={!latestActive} />
                </div>
                <Button asChild variant="outline" className="mt-5 w-full">
                  <Link to={latestActive ? '/jobs' : '/new'}>{latestActive ? 'Follow active run' : 'Create a brief'}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </section>

            <section className="surface-panel overflow-hidden" aria-labelledby="quick-research-heading">
              <div className="border-b border-border px-5 py-4">
                <h2 id="quick-research-heading" className="font-bold">Start with a question</h2>
              </div>
              <div className="divide-y divide-border">
                <QuickAction to="/new" icon={Globe2} title="Audit a website" detail="Experience, positioning, and evidence" />
                <QuickAction to="/new?type=keyword" icon={Search} title="Find companies" detail="Search a market using keywords" />
                <QuickAction to="/find-people" icon={Users} title="Find decision-makers" detail="Enrich company research with people" />
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6 surface-panel overflow-hidden">
          <Tabs defaultValue="keywords">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Search intelligence</p>
                <h2 className="mt-1.5 text-lg font-bold tracking-tight">Recent discovery work</h2>
              </div>
              <TabsList>
                <TabsTrigger value="keywords">Companies</TabsTrigger>
                <TabsTrigger value="people">People</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="keywords" className="m-0">
              <SearchList loading={isLoadingKeywords} empty="No company searches yet" items={(keywordSearches || []).slice(0, 6).map((item) => ({
                id: item.id,
                title: item.search_query,
                detail: item.company_name || 'Keyword research',
                createdAt: item.created_at,
              }))} />
            </TabsContent>
            <TabsContent value="people" className="m-0">
              <SearchList loading={isLoadingPeople} empty="No people searches yet" items={(peopleSearches || []).slice(0, 6).map((item) => ({
                id: item.id,
                title: item.query,
                detail: `${item.results?.length || 0} matches`,
                createdAt: item.created_at,
              }))} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone?: 'info' | 'success' }) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <span className="data-label">{label}</span>
        {tone === 'info' && <Clock3 className="h-4 w-4 text-info" />}
        {tone === 'success' && <CheckCircle2 className="h-4 w-4 text-success" />}
      </div>
      <p className="data-value mt-2">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function EvidenceStep({ icon: Icon, title, detail, active, complete }: { icon: typeof Check; title: string; detail: string; active?: boolean; complete?: boolean }) {
  return (
    <div className="relative pb-5 pl-7 last:pb-0">
      <span className={cn('absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full border bg-card', complete && 'border-success bg-success text-white', active && 'border-info bg-info text-white')}>
        <Icon className={cn('h-3 w-3', active && Icon === Loader2 && 'animate-spin')} />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

function QuickAction({ to, icon: Icon, title, detail }: { to: string; icon: typeof Search; title: string; detail: string }) {
  return (
    <Link to={to} className="pressable flex min-h-[72px] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-primary"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function SearchList({ items, loading, empty }: { items: Array<{ id: string; title: string; detail: string; createdAt: string }>; loading: boolean; empty: string }) {
  if (loading) {
    return <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-3 h-3 w-1/2" /></div>)}</div>
  }
  if (!items.length) {
    return <div className="p-10 text-center"><Sparkles className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{empty}</p></div>
  }
  return (
    <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="min-w-0 bg-card px-5 py-4">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="truncate">{item.detail}</span>
            <span className="shrink-0 font-mono">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }).replace('about ', '')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
