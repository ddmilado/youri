import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useBackgroundTasks } from '@/contexts/background-tasks-context'
import { supabase, runAIWorkflow, runKeywordSearch } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
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
                setIsSearchComplete(true)
                setSearchCompletionData({ count: payload.count, message: payload.message })
                toast.success(`Found ${payload.count || 0} companies!`)
                updateTask(searchId, {
                  status: 'completed',
                  progress: 100,
                  statusMessage: payload.message || 'Search complete!'
                })
                supabase.removeChannel(channel)
              } else if (payload.status === 'failed') {
                setIsSearchProcessing(false)
                setProcessingJobId(null)
                updateTask(searchId, {
                  status: 'failed',
                  statusMessage: payload.message || 'Search failed'
                })
                toast.error('Search failed')
                supabase.removeChannel(channel)
              }
            })
            .subscribe()
        } else {
          setIsSearchProcessing(false)
          setProcessingJobId(null)
          updateTask(searchId, { status: 'failed', statusMessage: result.error || 'Search failed' })
          toast.error(result.error || 'Failed to start search')
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
      <div className="mx-auto max-w-5xl">
        <header className="app-header">
          <div>
            <p className="eyebrow">Create</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">New Analysis</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Start a website audit or discover companies from a targeted keyword search.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/80">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary/10 text-secondary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>AI Lead Discovery</CardTitle>
                  <CardDescription>Choose a workflow and provide the source input.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-6 grid gap-2 rounded-lg bg-muted/70 p-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setWorkflowType('url')}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-all ${workflowType === 'url'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                    }`}
                >
                  <LinkIcon className="h-4 w-4" />
                  URL Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowType('keyword')}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-all ${workflowType === 'keyword'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                    }`}
                >
                  <Search className="h-4 w-4" />
                  Keyword Search
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="inputText">
                      {workflowType === 'keyword' ? 'Search Keywords' : workflowType === 'translation' ? 'Website URL' : 'Website URLs'} *
                    </Label>
                    {workflowType === 'url' && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${urlCount > 5
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                        : 'border-border bg-muted text-muted-foreground'
                        }`}>
                        {urlCount}/5 URLs
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="inputText"
                    placeholder={workflowType === 'keyword' ? "e.g. software companies Germany site:.de" : "https://example.com\nhttps://another-company.com"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    required
                    disabled={loading}
                    className="min-h-[180px] resize-y text-base leading-7"
                    rows={7}
                  />
                  <p className="text-xs text-muted-foreground">
                    {workflowType === 'keyword'
                      ? 'Use specific regions, industries, and search operators for cleaner results.'
                      : 'Enter one URL per line. Batches are limited to 5 URLs.'}
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {workflowType === 'keyword' ? 'Searching...' : 'Running AI Analysis...'}
                    </>
                  ) : workflowType === 'keyword' ? (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Find Companies
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Analyze URL
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <aside className="surface-panel h-fit p-5">
            <p className="text-sm font-semibold">Workflow Notes</p>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">URL Analysis</p>
                <p className="mt-1">Best for known companies or a short prospect list that needs deeper inspection.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Keyword Search</p>
                <p className="mt-1">Best for finding new companies from market, region, or industry signals.</p>
              </div>
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
