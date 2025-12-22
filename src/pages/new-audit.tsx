import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { supabase, runAIWorkflow, runKeywordSearch } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [progress, setProgress] = useState('')
  const [workflowType, setWorkflowType] = useState<'keyword' | 'url'>('keyword')
  const [processingJobId, setProcessingJobId] = useState<string | null>(null)
  const [isSearchProcessing, setIsSearchProcessing] = useState(false)
  const [isSearchComplete, setIsSearchComplete] = useState(false)

  const navigate = useNavigate()
  const { user } = useAuth()

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

    setLoading(true)

    try {
      if (workflowType === 'keyword') {
        // Keyword search workflow
        const searchId = crypto.randomUUID()
        setProcessingJobId(searchId) // Use this as the channel ID
        setIsSearchProcessing(true)
        setIsSearchComplete(false)

        const result = await runKeywordSearch(inputText, user.id, searchId)

        if (result.success) {
          setIsSearchComplete(true)
          toast.success(`Found ${result.count || 0} companies!`)
        } else {
          setIsSearchProcessing(false)
          setProcessingJobId(null)
          toast.error(result.error || 'Failed to complete search')
        }
      } else {
        // URL analysis workflow
        const { data: newJob, error: insertError } = await supabase
          .from('jobs')
          .insert({
            user_id: user.id,
            url: inputText,
            title: (inputText.includes('://') ? new URL(inputText).hostname : inputText) || inputText,
            status: 'pending'
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (newJob) {
          setProcessingJobId(newJob.id)
          runAIWorkflow(inputText, user.id, newJob.id).catch(err => {
            console.error('Workflow trigger failed:', err)
          })
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
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto min-h-screen flex items-center">
      <Card className="w-full">
        <CardHeader className="p-4 md:p-6 pb-0 md:pb-6">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <CardTitle className="text-2xl md:text-3xl">AI Lead Discovery</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Choose your workflow: Quick keyword search or deep URL analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Workflow Type Tabs */}
          <div className="flex gap-1 md:gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setWorkflowType('keyword')}
              className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-md transition-all flex items-center justify-center gap-1.5 md:gap-2 ${workflowType === 'keyword'
                ? 'bg-white dark:bg-gray-800 shadow-sm'
                : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <Search className="h-4 w-4" />
              <span className="font-medium text-xs md:text-sm">Keyword Search</span>
            </button>
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
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="inputText">
                {workflowType === 'keyword' ? 'Search Keywords' : 'Website URL'} *
              </Label>
              <Input
                id="inputText"
                placeholder={
                  workflowType === 'keyword'
                    ? "e.g., 'software companies Germany site:.de'"
                    : "e.g., 'https://example.com'"
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                required
                disabled={loading}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                {workflowType === 'keyword'
                  ? 'Enter keywords to discover companies'
                  : 'Enter a website URL for deep analysis'}
              </p>
            </div>

            <div className={`rounded-lg p-3 md:p-4 border ${workflowType === 'keyword'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              }`}>
              <div className="flex items-start gap-3">
                {workflowType === 'keyword' ? (
                  <Search className="h-5 w-5 text-slate-700 dark:text-slate-300 mt-0.5 flex-shrink-0" />
                ) : (
                  <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-2 text-sm">
                  <p className={`font-medium ${workflowType === 'keyword'
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-emerald-900 dark:text-emerald-100'
                    }`}>
                    {workflowType === 'keyword' ? 'Quick Discovery (10-15 sec)' : 'Deep Analysis (30-60 sec)'}
                  </p>
                  <ul className={`space-y-1 text-xs ${workflowType === 'keyword'
                    ? 'text-slate-700 dark:text-slate-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                    }`}>
                    {workflowType === 'keyword' ? (
                      <>
                        <li>• Company name & website discovery</li>
                        <li>• Brief company descriptions</li>
                        <li>• Multiple results per search</li>
                        <li>• Option to run deep analysis later</li>
                      </>
                    ) : (
                      <>
                        <li>• Google Search & URL Discovery</li>
                        <li>• German Market Validation</li>
                        <li>• Localization Quality Analysis</li>
                        <li>• Lead Scoring & Company Insights</li>
                        <li>• Contact Discovery & Structuring</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className={`w-full ${workflowType === 'keyword'
                ? 'bg-slate-700 hover:bg-slate-800'
                : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {workflowType === 'keyword' ? 'Searching...' : 'Running AI Analysis...'}
                </>
              ) : (
                <>
                  {workflowType === 'keyword' ? (
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
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AnimatePresence>
        {processingJobId && (
          <ProcessingOverlay
            jobId={processingJobId}
            onClose={() => setProcessingJobId(null)}
          />
        )}
        {isSearchProcessing && (
          <ProcessingOverlay
            type="search"
            jobId={processingJobId || undefined}
            manualSubtitle={inputText}
            isManualComplete={isSearchComplete}
            onManualComplete={() => {
              navigate('/jobs')
              setIsSearchProcessing(false)
            }}
            onClose={() => setIsSearchProcessing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
