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
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto min-h-screen flex items-center flex-col">
      <Card className="w-full">
        <CardHeader className="p-4 md:p-6 pb-0 md:pb-6">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <CardTitle className="text-2xl md:text-3xl">AI Lead Discovery</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Choose your workflow: Search, Audit, or Translation Check
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Workflow Type Tabs */}
          <div className="flex gap-1 md:gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setWorkflowType('url')}
              className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-md transition-all flex items-center justify-center gap-1.5 md:gap-2 ${workflowType === 'url'
                ? 'bg-white dark:bg-gray-800 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <LinkIcon className="h-4 w-4" />
              <span className="font-medium text-xs md:text-sm">URL Analysis</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkflowType('keyword')}
              className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-md transition-all flex items-center justify-center gap-1.5 md:gap-2 ${workflowType === 'keyword'
                ? 'bg-white dark:bg-gray-800 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <Search className="h-4 w-4" />
              <span className="font-medium text-xs md:text-sm">Keyword</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="inputText">
                {workflowType === 'keyword' ? 'Search Keywords' : workflowType === 'translation' ? 'Website URL' : 'Website URLs'} *
              </Label>
              {workflowType === 'keyword' ? (
                <Textarea
                  id="inputText"
                  placeholder="e.g., 'software companies Germany site:.de'"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  required
                  disabled={loading}
                  className="text-base min-h-[120px] resize-y"
                  rows={4}
                />
              ) : (
                <Textarea
                  id="inputText"
                  placeholder={workflowType === 'translation' ? "https://example.com" : "Enter one URL per line..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  required
                  disabled={loading}
                  className="text-base min-h-[120px] resize-y"
                  rows={4}
                />
              )}
              {workflowType === 'url' && (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    Enter one or more URLs (one per line) for deep analysis. Maximum 5 URLs per batch.
                  </p>
                  <span className={`text-xs font-medium ${inputText.split('\n').filter(u => u.trim().length > 0).length > 5
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                    }`}>
                    {inputText.split('\n').filter(u => u.trim().length > 0).length}/5 URLs
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full transition-all duration-200 bg-emerald-600"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{workflowType === 'keyword' ? 'Searching...' : 'Running AI Analysis...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  {workflowType === 'keyword' ? (
                    <>
                      <Search className="h-5 w-5" />
                      <span>Find Companies</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span>Analyze URL</span>
                    </>
                  )}
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
