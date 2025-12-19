import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, type AuditSection } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2,
  ArrowLeft,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckSquare,
  ExternalLink,
  Building2,
  Users,
  Linkedin,
  Mail,
  History,
  TrendingUp,
  User
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type Job = Database['public']['Tables']['jobs']['Row']

const loadingSteps = [
  'Launching AI agents...',
  'Crawling website content...',
  'Analyzing legal compliance...',
  'Checking UX & Conversion...',
  'Compiling final report...',
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
    }
  }, [job?.status])

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !job) return
    setIsExporting(true)
    try {
      // Temporary style adjustments for PDF capture
      const originalStyle = reportRef.current.style.cssText
      reportRef.current.style.width = '1200px'
      reportRef.current.style.backgroundColor = '#ffffff'

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      })

      reportRef.current.style.cssText = originalStyle

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

      while (heightLeft > margin) {
        position = heightLeft - imgHeight + margin
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, -pdf.internal.pageSize.getHeight() + margin, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const sanitized = job.url.replace(/https?:\/\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
      pdf.save(`audit-${sanitized}.pdf`)
      toast.success('PDF downloaded!')
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('Failed to generate PDF')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Report not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  // Helper to determine deep audit vs legacy report
  const isDeepAudit = job.report && 'sections' in job.report
  const report = job.report

  // Severity helpers
  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      case 'medium':
        return 'text-amber-600 bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
      default:
        return 'text-slate-600 bg-slate-100 border-slate-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
      case 'low':
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-500" />
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
    }
  }

  // Loading State Overlay
  if (job.status === 'processing' || job.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="border-emerald-100 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
              <CardTitle className="text-xl text-emerald-950 dark:text-emerald-50">Analyzing Website</CardTitle>
              <CardDescription>{job.url}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Progress value={(loadingStep + 1) * (100 / loadingSteps.length)} className="h-2 bg-emerald-100" />
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400"
                  >
                    {loadingSteps[loadingStep]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <p className="text-center text-xs text-muted-foreground">This deep audit may take up to 60 seconds.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Render main content
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="hidden md:block w-px h-6 bg-border mx-2"></div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-foreground">{job.title}</h1>
            <p className="text-xs text-muted-foreground">{job.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
          <a href={job.url.startsWith('http') ? job.url : `https://${job.url}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8" ref={reportRef}>

        {/* OVERVIEW HERO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-indigo-900 to-slate-900 text-white">
            <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardContent className="p-8 relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <Badge className="mb-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-none">Analysis Complete</Badge>
                  <h2 className="text-3xl font-bold mb-4 text-white">Audit Overview</h2>
                  <p className="text-slate-200 leading-relaxed text-lg opacity-90">
                    {report?.overview || "No overview available for this audit."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Verified on {new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-400" />
                      <span>{report?.sections?.length || 0} Key Areas Analyzed</span>
                    </div>
                  </div>
                </div>

                {/* Score Card (Mock Calculation for Visuals) */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center justify-center min-w-[200px] border border-white/10">
                  <span className="text-slate-300 text-sm font-medium mb-2">Audit Score</span>
                  <div className="text-5xl font-bold text-white mb-1">
                    {job.status === 'completed' ? 85 : 0}
                    <span className="text-lg text-slate-400 font-normal">/100</span>
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-2">
                    <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* CONTENT SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: FINDINGS */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Detailed Findings</h3>
              <Badge variant="outline">{report?.sections?.reduce((acc, s) => acc + s.findings.length, 0) || 0} Issues Found</Badge>
            </div>

            {report?.sections?.map((section: AuditSection, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {section.findings.map((finding, findIndex) => (
                        <AccordionItem key={findIndex} value={`item-${index}-${findIndex}`} className="border-b last:border-0 px-6">
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-start gap-3 text-left">
                              <div className="mt-0.5">{getSeverityIcon(finding.severity)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{finding.problem}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${getSeverityColor(finding.severity)}`}>
                                    {finding.severity?.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-4 pl-8">
                            <div className="space-y-3 text-sm text-muted-foreground">
                              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Analysis & Source:</p>
                                <p>{finding.explanation}</p>
                              </div>
                              <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-md border border-emerald-100 dark:border-emerald-900/50">
                                <CheckSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium mb-1">Recommendation:</p>
                                  <p>{finding.recommendation}</p>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {!isDeepAudit && report?.issues && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  This is a legacy report format. Findings are listed below.
                  {/* Fallback for legacy issues rendering if needed */}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ACTION PLAN */}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Action Plan</h3>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-950/30 rounded-full -mr-16 -mt-16 z-0"></div>
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="text-base font-medium text-indigo-900 dark:text-indigo-100">Next Steps</CardTitle>
                <CardDescription>Prioritized checklist to improve compliance and conversion.</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 pt-4">
                <ul className="space-y-3">
                  {report?.actionList?.map((action, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm group">
                      <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-white transition-colors cursor-pointer hover:bg-indigo-600 hover:border-indigo-600">
                        {/* Checkbox state logic could go here */}
                      </div>
                      <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{action}</span>
                    </li>
                  ))}
                  {(!report?.actionList || report.actionList.length === 0) && (
                    <li className="text-sm text-muted-foreground italic">No specific actions generated.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* COMPANY PROFILE */}
          {report?.companyInfo && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    Company Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-muted-foreground">Company:</span>
                      <span className="text-right font-medium">{report.companyInfo.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Industry:</span>
                      <span className="font-medium text-right">{report.companyInfo.industry || 'Not found'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">HQ:</span>
                      <span className="font-medium text-right">{report.companyInfo.hq_location || 'Not found'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Founded:</span>
                      <span className="font-medium text-right">{report.companyInfo.founded || 'Not found'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Size:</span>
                      <span className="font-medium text-right">{report.companyInfo.employees || 'Not found'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Revenue:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 font-semibold text-right">{report.companyInfo.revenue || 'Not found'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* LEADERSHIP & CONTACTS */}
          {report?.companyInfo?.contacts && report.companyInfo.contacts.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    Leadership & Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {report.companyInfo.contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{contact.name}</div>
                          <div className="flex gap-2">
                            {contact.linkedin && !contact.linkedin.toLowerCase().includes('not found') && (
                              <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                                <Linkedin className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {contact.email && !contact.email.toLowerCase().includes('not found') && (
                              <a href={`mailto:${contact.email}`} className="text-slate-500 hover:text-slate-700">
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground italic">
                          {contact.title === 'Not found' ? 'Role not identified' : contact.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Conclusion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {report?.conclusion || "Audit completed."}
              </p>
            </CardContent>
          </Card>

        </div>

      </main>
    </div>
  )
}

