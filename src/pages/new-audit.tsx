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
          toast.success('Lead analysis completed successfully!')

          setTimeout(() => {
            navigate('/dashboard')
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
    <div className="p-6 lg:p-8 max-w-2xl mx-auto min-h-screen flex items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-3xl">AI Lead Discovery</CardTitle>
          <CardDescription>
            Choose your workflow: Quick keyword search or deep URL analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Workflow Type Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setWorkflowType('keyword')}
              className={`flex-1 py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 ${workflowType === 'keyword'
                  ? 'bg-white dark:bg-gray-800 shadow-sm'
                  : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <Search className="h-4 w-4" />
              <span className="font-medium">Keyword Search</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkflowType('url')}
              className={`flex-1 py-2 px-4 rounded-md transition-all flex items-center justify-center gap-2 ${workflowType === 'url'
                  ? 'bg-white dark:bg-gray-800 shadow-sm'
                  : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <LinkIcon className="h-4 w-4" />
              <span className="font-medium">URL Analysis</span>
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

            <div className={`bg-gradient-to-br rounded-lg p-4 border ${workflowType === 'keyword'
                ? 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800'
                : 'from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800'
              }`}>
              <div className="flex items-start gap-3">
                {workflowType === 'keyword' ? (
                  <Search className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-2 text-sm">
                  <p className={`font-medium ${workflowType === 'keyword'
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-purple-900 dark:text-purple-100'
                    }`}>
                    {workflowType === 'keyword' ? 'Quick Discovery (10-15 sec)' : 'Deep Analysis (30-60 sec)'}
                  </p>
                  <ul className={`space-y-1 text-xs ${workflowType === 'keyword'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-purple-700 dark:text-purple-300'
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
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
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
