import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { triggerWorkflow } from '@/lib/n8n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { z } from 'zod'

const formSchema = z.object({
  targetCountry: z.string().min(1, 'Target country is required'),
  searchKeywords: z.string().optional(),
  siteOperator: z.string().optional(),
  targetUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
}).refine(
  (data) => data.searchKeywords || data.targetUrl,
  {
    message: 'Either search keywords or target URL must be provided',
    path: ['searchKeywords'],
  }
)

export function NewAuditPage() {
  const [targetCountry, setTargetCountry] = useState('')
  const [searchKeywords, setSearchKeywords] = useState('')
  const [siteOperator, setSiteOperator] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      formSchema.parse({
        targetCountry,
        searchKeywords: searchKeywords || undefined,
        siteOperator: siteOperator || undefined,
        targetUrl: targetUrl || undefined,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message)
      }
      return
    }

    setLoading(true)
    try {
      const payload: any = {
        targetCountry,
        userId: user?.id || 'anonymous',
      }

      if (searchKeywords) payload.searchKeywords = searchKeywords
      if (siteOperator) payload.siteOperator = siteOperator
      if (targetUrl) payload.targetUrl = targetUrl

      const result = await triggerWorkflow(payload)

      if (result.success) {
        toast.success(result.message || 'Workflow started successfully!')
        navigate('/jobs')
      } else {
        toast.error('Failed to start workflow')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start workflow')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto min-h-screen flex items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-3xl">Lead Discovery Analysis</CardTitle>
          <CardDescription>Search for leads or analyze a specific URL</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="targetCountry">Target Country *</Label>
              <Input
                id="targetCountry"
                placeholder="e.g., Germany, UAE, France"
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">The country to target for analysis</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchKeywords">Search Keywords</Label>
              <Input
                id="searchKeywords"
                placeholder="e.g., software companies, ecommerce"
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Keywords to search for potential leads</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteOperator">Site Operator</Label>
              <Input
                id="siteOperator"
                placeholder="e.g., site:.nl, site:.de"
                value={siteOperator}
                onChange={(e) => setSiteOperator(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Optional site operator to narrow search results</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUrl">Target URL</Label>
              <Input
                id="targetUrl"
                type="url"
                placeholder="https://example.com"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Or analyze a specific website directly</p>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> You must provide either search keywords or a target URL (or both) to proceed.
              </p>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting Analysis...
                </>
              ) : (
                'Start Analysis'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
