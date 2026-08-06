import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useBackgroundTasks } from '@/contexts/background-tasks-context'
import { supabase, runAIWorkflow, runKeywordSearch } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Search, Sparkles, Link as LinkIcon } from 'lucide-react'
import { z } from 'zod'
import { ProcessingOverlay } from '@/components/processing-overlay'
import { AnimatePresence } from 'framer-motion'

const formSchema = z.object({
  inputText: z.string().min(1, 'Please enter a keyword or URL'),
})

export function NewAuditPage() {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [workflowType, setWorkflowType] = useState<'keyword' | 'url' | 'translation'>('url')
  const [processingJobId, setProcessingJobId] = useState<string | null>(null)
  const [isSearchProcessing, setIsSearchProcessing] = useState(false)
  const [isSearchComplete, setIsSearchComplete] = useState(false)
  const [searchCompletionData, setSearchCompletionData] = useState<{ count?: number, message?: string } | null>(null)

  const navigate = useNavigate()
  const { user } = useAuth()
  const { addTask, updateTask, tasks } = useBackgroundTasks()
  const urlCount = inputText.split('\n').filter(u => u.trim().length > 0).length

  const handleMinimizeAudit = (jobId: string, url: string) => {
    // Only add if not already in the tray
    if (!tasks.some(t => t.id === jobId)) {
      addTask({
        id: jobId,
        type: 'audit',
        status: 'processing',
        title: 'Deep Audit',
        subtitle: url,
        progress: 0,
        statusMessage: 'Analyzing in background...'
      })
    }
    setProcessingJobId(null)
    toast.info('Audit running in background')
  }

  const handleMinimizeSearch = (searchId: string, query: string) => {
    const status = isSearchComplete ? 'completed' : 'processing'
    const statusMessage = isSearchComplete ? (searchCompletionData?.message || 'Search complete!') : undefined

    if (!tasks.some(t => t.id === searchId)) {
      addTask({
        id: searchId,
        type: 'search',
        status: status,
        title: 'Keyword Search',
        subtitle: query,
        progress: isSearchComplete ? 100 : 0,
        statusMessage: statusMessage
      })
    }
    setIsSearchProcessing(false)
    toast.info(isSearchComplete ? 'Search completed' : 'Search running in background')
  }

  const checkKeywordResults = async (query: string) => {
    if (!user?.id) return 0
    const { count, error } = await supabase
      .from('keyword_search_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('search_query', query)

    if (error) {
      console.warn('Keyword result check failed:', error)
      return 0
    }

    return count || 0
  }

  const completeKeywordSearch = (searchId: string, count: number, message?: string) => {
    setIsSearchComplete(true)
    setSearchCompletionData({ count, message: message || 'Search complete!' })
    updateTask(searchId, {
      status: 'completed',
      progress: 100,
      statusMessage: message || 'Search complete!'
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      formSchema.parse({ inputText })
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0].message)
      }
      return
    }

    if (!user?.id) {
      toast.error('You must be logged in to run analysis')
      return
    }

    // Check URL count limit for URL analysis
    if (workflowType === 'url') {
      const urls = inputText
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0)

      if (urls.length > 5) {
        toast.error('Maximum 5 URLs allowed per batch. Please reduce the number of URLs.')
        return
      }
    }

    setLoading(true)

    try {
      if (workflowType === 'keyword') {
        // Keyword user workflow
        const searchId = crypto.randomUUID()
        setProcessingJobId(searchId) // Use this as the channel ID
        setIsSearchProcessing(true)
        setIsSearchComplete(false)

        const result = await runKeywordSearch(
          inputText,
          user.id,
          searchId,
          user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown User',
          user.email || undefined
        )

        if (result.success) {
          toast.info('Search started! Results will appear shortly...')

          const channel = supabase.channel(`search-status-${searchId}`)
            .on('broadcast', { event: 'status_update' }, ({ payload }) => {
              if (payload.status === 'completed') {
                completeKeywordSearch(searchId, payload.count || 0, payload.message)
                toast.success(`Found ${payload.count || 0} companies!`)
                supabase.removeChannel(channel)
              } else if (payload.status === 'failed') {
                checkKeywordResults(inputText).then((existingCount) => {
                  if (existingCount > 0) {
                    completeKeywordSearch(searchId, existingCount, 'Search complete!')
                    toast.success(`Found ${existingCount} companies!`)
                  } else {
                    setIsSearchProcessing(false)
                    setProcessingJobId(null)
                    updateTask(searchId, {
                      status: 'failed',
                      statusMessage: payload.message || 'Search failed'
                    })
                    toast.error(payload.message || 'Search failed')
                  }
                  supabase.removeChannel(channel)
                })
              }
            })
            .subscribe()
        } else {
          const existingCount = await checkKeywordResults(inputText)
          if (existingCount > 0) {
            completeKeywordSearch(searchId, existingCount, 'Search complete!')
            toast.success(`Found ${existingCount} companies!`)
          } else {
            setIsSearchProcessing(false)
            setProcessingJobId(null)
            updateTask(searchId, { status: 'failed', statusMessage: result.error || 'Search failed' })
            toast.error(result.error || 'Failed to start search')
          }
        }
      } else {
        // URL analysis workflow - supports multiple URLs
        const urls = inputText
          .split('\n')
          .map(u => u.trim())
          .filter(u => u.length > 0)

        if (urls.length === 0) {
          toast.error('Please enter at least one URL')
          return
        }

        if (urls.length === 1) {
          const url = urls[0]
          const { data: newJob, error: insertError } = await supabase
            .from('jobs')
            .insert({
              user_id: user.id,
              url: url,
              title: (url.includes('://') ? new URL(url).hostname : url) || url,
              status: 'pending',
              creator_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
              creator_email: user.email
            })
            .select()
            .single()

          if (insertError) throw insertError

          if (newJob) {
            setProcessingJobId(newJob.id)
            // Also add to background tasks so it shows in the tray if minimized
            addTask({
              id: newJob.id,
              type: 'audit',
              status: 'processing',
              title: newJob.title,
              subtitle: newJob.url,
              progress: 0,
              statusMessage: 'Initializing audit...'
            })
            try {
              const result = await runAIWorkflow(url, user.id, newJob.id)
              if (result && result.success === false) {
                toast.error(result.error || 'Failed to trigger audit')
              } else {
                toast.success('Audit started! Check dashboard for progress.')
              }
            } catch (err) {
              console.warn('Workflow trigger error:', err)
              toast.info('Audit started - check dashboard for progress')
            }
          }
        } else {
          if (urls.length > 5) {
            toast.error('Maximum 5 URLs allowed per batch.')
            return
          }

          toast.info(`Starting ${urls.length} audits in background...`)

          for (const url of urls) {
            try {
              const { data: newJob, error: insertError } = await supabase
                .from('jobs')
                .insert({
                  user_id: user.id,
                  url: url,
                  title: (url.includes('://') ? new URL(url).hostname : url) || url,
                  status: 'pending',
                  creator_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
                  creator_email: user.email
                })
                .select()
                .single()

              if (insertError) {
                console.error('Failed to create job', insertError)
                continue
              }

              if (newJob) {
                addTask({
                  id: newJob.id,
                  type: 'audit',
                  status: 'processing',
                  title: 'Deep Audit',
                  subtitle: url,
                  progress: 0,
                })

                runAIWorkflow(url, user.id, newJob.id).catch(console.error)
              }
            } catch (err) {
              console.error('Failed to start audit', err)
            }
          }
          toast.success(`${urls.length} audits running in background`)
          setInputText('')
        }
      }
    } catch (error) {
      console.error('Workflow error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to run workflow')
      setIsSearchProcessing(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-page">
      <div className="mx-auto max-w-6xl">
        <header className="app-header">
          <div>
            <p className="eyebrow">Research brief</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] md:text-4xl">What should the agent investigate?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Choose a research method, give the agent a precise target, and follow the evidence as it browses.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-2 py-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            Browser agent ready
          </Badge>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="space-y-2" aria-label="Research method">
            <p className="data-label mb-3 px-1">Research method</p>
            <button
              type="button"
              onClick={() => setWorkflowType('url')}
              className={`pressable w-full rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                workflowType === 'url' ? 'border-primary bg-primary/[0.055] shadow-sm' : 'border-border bg-card hover:border-foreground/20'
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${workflowType === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <LinkIcon className="h-[18px] w-[18px]" />
              </span>
              <span className="mt-3 block text-sm font-bold">Website audit</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">Inspect a known website with a real browser.</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkflowType('keyword')}
              className={`pressable w-full rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                workflowType === 'keyword' ? 'border-primary bg-primary/[0.055] shadow-sm' : 'border-border bg-card hover:border-foreground/20'
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${workflowType === 'keyword' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Search className="h-[18px] w-[18px]" />
              </span>
              <span className="mt-3 block text-sm font-bold">Company discovery</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">Find companies from market signals and keywords.</span>
            </button>
          </aside>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle>{workflowType === 'keyword' ? 'Company discovery brief' : 'Website audit brief'}</CardTitle>
              <CardDescription>
                {workflowType === 'keyword'
                  ? 'Describe the companies and market you want the agent to find.'
                  : 'Add up to five websites. The agent will browse and audit each one independently.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="inputText" className="text-sm font-semibold">
                      {workflowType === 'keyword' ? 'Search brief' : 'Website URLs'}
                    </Label>
                    {workflowType === 'url' && (
                      <span className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium ${
                        urlCount > 5 ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted text-muted-foreground'
                      }`}>
                        {urlCount} / 5
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="inputText"
                    placeholder={workflowType === 'keyword'
                      ? 'Example: B2B cybersecurity companies in Germany serving manufacturers, with 20–200 employees'
                      : 'https://example.com\nhttps://another-company.com'}
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    required
                    disabled={loading}
                    className="min-h-[240px] resize-y bg-card font-mono text-sm leading-7"
                    rows={9}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {workflowType === 'keyword'
                      ? 'Include industry, location, company size, exclusions, or search operators when they matter.'
                      : 'Use one URL per line. Include the full domain for the most reliable browser session.'}
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Results stay available in your workspace history.</p>
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : workflowType === 'keyword' ? <Search className="mr-2 h-5 w-5" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    {loading ? 'Starting agent…' : workflowType === 'keyword' ? 'Find companies' : `Start ${urlCount > 1 ? `${urlCount} audits` : 'audit'}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <aside className="surface-panel h-fit overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="eyebrow">Evidence plan</p>
              <h2 className="mt-1.5 text-sm font-bold">What the agent will do</h2>
            </div>
            <div className="px-5 py-5">
              <div className="evidence-rail">
                {(workflowType === 'keyword'
                  ? [
                      ['Interpret the brief', 'Identify constraints and search signals'],
                      ['Search the live web', 'Browse results and candidate websites'],
                      ['Verify each company', 'Check relevance against your criteria'],
                      ['Structure the findings', 'Return comparable company records'],
                    ]
                  : [
                      ['Open a browser', 'Navigate the live website'],
                      ['Inspect key journeys', 'Review content, UX, and trust signals'],
                      ['Collect evidence', 'Capture sources behind each finding'],
                      ['Build the audit', 'Organize risks and opportunities'],
                    ]
                ).map(([title, detail], index) => (
                  <div key={title} className="relative pb-5 pl-7 last:pb-0">
                    <span className="absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full border border-border bg-card font-mono text-[9px] font-bold text-primary">{index + 1}</span>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border bg-muted/25 px-5 py-4 text-xs leading-5 text-muted-foreground">
              You can minimize the run at any time. The agent continues on the VPS and returns the result here.
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {processingJobId && !isSearchProcessing && workflowType === 'url' && (
          <ProcessingOverlay
            jobId={processingJobId}
            onClose={() => setProcessingJobId(null)}
            onMinimize={() => handleMinimizeAudit(processingJobId, inputText)}
          />
        )}
        {isSearchProcessing && (
          <ProcessingOverlay
            type="search"
            jobId={processingJobId || undefined}
            manualSubtitle={inputText}
            isManualComplete={isSearchComplete}
            onManualComplete={() => {
              navigate('/jobs?tab=searches')
              setIsSearchProcessing(false)
            }}
            onClose={() => setIsSearchProcessing(false)}
            onMinimize={() => handleMinimizeSearch(processingJobId || '', inputText)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
