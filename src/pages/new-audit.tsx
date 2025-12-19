import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { runAIWorkflow, runKeywordSearch } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Search, Sparkles, Link as LinkIcon } from 'lucide-react'
import { z } from 'zod'

const formSchema = z.object({
  inputText: z.string().min(1, 'Please enter a keyword or URL'),
})

export function NewAuditPage() {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [workflowType, setWorkflowType] = useState<'keyword' | 'url'>('keyword')
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
        setProgress('Searching for companies...')
        const result = await runKeywordSearch(inputText, user.id)

        if (result.success) {
          setProgress('Search complete!')
          toast.success(`Found ${result.count || 0} companies!`)

          setTimeout(() => {
            navigate('/jobs')
          }, 1000)
        } else {
          toast.error(result.error || 'Failed to complete search')
        }
      } else {
        // URL analysis workflow
        setProgress('Initializing AI workflow...')
        setProgress('Running multi-agent analysis...')
        const result = await runAIWorkflow(inputText, user.id)

        if (result.success) {
          setProgress('Analysis complete!')
          toast.success('Deep audit completed successfully!')

          // In standard flow, the backend might return job_id directly
          // We check for job_id (new flow) or fall back to ID (legacy flow if any)
          const redirectId = result.job_id || result.result?.id

          setTimeout(() => {
            // Redirect to the report page
            if (redirectId) {
              navigate(`/report/${redirectId}`)
            } else {
              navigate('/dashboard')
            }
          }, 1000)
        } else {
          toast.error(result.error || 'Failed to complete analysis')
        }
      }
    } catch (error) {
      console.error('Workflow error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to run workflow')
    } finally {
      setLoading(false)
      setProgress('')
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

            {loading && progress && (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{progress}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {workflowType === 'keyword' ? 'Searching for companies...' : 'AI agents are analyzing the data...'}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
    </div>
  )
}
