import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, type JobReport } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, ArrowLeft, Copy, Download, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type Job = Database['public']['Tables']['jobs']['Row']

const loadingSteps = [
  'Launching browser...',
  'Loading page...',
  'Taking screenshot...',
  'Analyzing content...',
  'Checking for issues...',
  'Generating report...',
]

export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loadingStep, setLoadingStep] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single<Job>()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`job-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` }, (payload) => {
        queryClient.setQueryData<Job>(['job', id], payload.new as Job)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, queryClient])

  useEffect(() => {
    if (job?.status === 'processing' || job?.status === 'pending') {
      const interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [job?.status])

  useEffect(() => {
    if (job?.status === 'failed') {
      toast.error('Audit failed. Please try again.')
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }, [job?.status, navigate])

  const handleCopyReport = async () => {
    if (!job?.report) return
    const reportText = generateReportText(job)
    try {
      await navigator.clipboard.writeText(reportText)
      toast.success('Report copied to clipboard!')
    } catch {
      toast.error('Failed to copy report')
    }
  }

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !job) return
    setIsExporting(true)
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let position = margin
      let heightLeft = imgHeight

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const sanitized = job.url.replace(/https?:\/\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
      pdf.save(`siteaudit-${sanitized}.pdf`)
      toast.success('PDF downloaded!')
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('Failed to generate PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const generateReportText = (job: Job) => {
    let text = `SiteAudit Report\n\n`
    text += `Title: ${job.title}\n`
    text += `URL: ${job.url}\n`
    text += `Status: ${job.status}\n`
    text += `Generated: ${new Date(job.created_at).toLocaleString()}\n\n`
    if (job.report?.issues) {
      text += `Issues Found: ${job.report.issues.length}\n\n`
      job.report.issues.forEach((issue, index) => {
        text += `${index + 1}. ${issue.title || issue.type}\n`
        text += `   ${issue.description || issue.message || 'No description'}\n`
        if (issue.severity) text += `   Severity: ${issue.severity}\n`
        text += `\n`
      })
    }
    return text
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Report not found</h2>
          <Link to="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'text-red-500'
      case 'medium':
        return 'text-orange-500'
      case 'low':
        return 'text-yellow-500'
      default:
        return 'text-blue-500'
    }
  }

  const getSeverityIcon = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'low':
        return <Info className="h-5 w-5 text-yellow-500" />
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
  }

  const issueCount = job.report?.issuesCount ?? 0
  const issueBadgeColor = issueCount > 10 ? 'bg-red-500/10 text-red-500' : issueCount > 5 ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 lg:p-8" ref={reportRef}>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Badge className={issueBadgeColor}>{issueCount} Issues</Badge>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {job.screenshot_url && (
            <Card className="overflow-hidden">
              <img
                src={job.screenshot_url}
                alt="Website screenshot"
                className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(job.screenshot_url!, '_blank')}
              />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl mb-2">{job.title}</CardTitle>
              <p className="text-muted-foreground truncate">{job.url}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleCopyReport} variant="outline">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Report
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" disabled={isExporting}>
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issues Found</CardTitle>
            </CardHeader>
            <CardContent>
              {job.report?.issues && job.report.issues.length > 0 ? (
                <div className="space-y-4">
                  {job.report.issues.map((issue: JobReport['issues'][number], index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">{getSeverityIcon(issue.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{issue.title || issue.type}</h4>
                          {issue.severity && (
                            <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description || issue.message || 'No description available'}</p>
                        {issue.element && (
                          <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">{issue.element}</code>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium mb-2">No issues found!</p>
                  <p className="text-sm text-muted-foreground">Your website looks great. Keep up the good work!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {(job.status === 'processing' || job.status === 'pending') && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-center text-2xl">Analyzing Website</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-primary/20 rounded-full" />
                    <div className="absolute top-0 left-0 w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={(loadingStep + 1) * (100 / loadingSteps.length)} className="h-2" />
                  <AnimatePresence mode="wait">
                    <motion.p key={loadingStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center text-sm text-muted-foreground">
                      {loadingSteps[loadingStep]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-center text-xs text-muted-foreground">This may take up to 30 seconds</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  )
}
