import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Database, type AuditSection } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  User,
  Share2,
  Phone,
  Languages,
  Globe2,
  ShieldCheck,
  Camera
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type Job = Database['public']['Tables']['jobs']['Row']



export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isExporting, setIsExporting] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [reportLanguage, setReportLanguage] = useState<'en' | 'nl'>('en')
  const [dutchReport, setDutchReport] = useState<Database['public']['Tables']['jobs']['Row']['report'] | null>(null)
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
    if (job?.status === 'failed') {
      toast.error('Audit failed. Please try again.')
    }
  }, [job?.status])

  const { user } = useAuth()
  const isOwner = user?.id === job?.user_id

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

  const handleShare = async () => {
    if (!job) return
    const newPublicState = !job.is_public
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_public: newPublicState })
        .eq('id', job.id)

      if (error) throw error

      queryClient.setQueryData<Job>(['job', id], { ...job, is_public: newPublicState })

      if (newPublicState) {
        navigator.clipboard.writeText(window.location.href)
        toast.success('Report is now public! Link copied to clipboard.')
      } else {
        toast.info('Report is now private.')
      }
    } catch {
      toast.error('Failed to update share settings')
    }
  }

  const handleToggleLanguage = async () => {
    if (!job?.report) return

    if (reportLanguage === 'nl') {
      setReportLanguage('en')
      return
    }

    if (dutchReport) {
      setReportLanguage('nl')
      return
    }

    setIsTranslating(true)
    try {
      const { data, error } = await supabase.functions.invoke('translate-report', {
        body: {
          report: job.report,
          target_language: 'Dutch'
        }
      })

      if (error) throw error
      if (!data?.success || !data?.report) {
        throw new Error(data?.error || 'Translation failed')
      }

      setDutchReport(data.report)
      setReportLanguage('nl')
      toast.success('Dutch report generated')
    } catch (error) {
      console.error('Report translation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to translate report')
    } finally {
      setIsTranslating(false)
    }
  }



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Report not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    )
  }

  // Helper to determine deep audit vs legacy report
  const report = reportLanguage === 'nl' && dutchReport ? dutchReport : job.report
  const isDeepAudit = report && 'sections' in report
  const legacyIssues = (report as { issues?: unknown[] } | null)?.issues

  // Calculate score if not present in report
  const auditScore = report?.score ?? (() => {
    if (!report || !report.sections) return 0
    let score = 100
    report.sections.forEach(section => {
      section.findings.forEach(finding => {
        const sev = finding.severity?.toLowerCase()
        if (sev === 'high' || sev === 'critical') score -= 10
        else if (sev === 'medium') score -= 5
        else if (sev === 'low') score -= 2
      })
    })
    return Math.max(0, score)
  })()

  const criticalIssues = report?.criticalIssues || []
  const keyFindings = report?.keyFindings || []
  const languageSummary = report?.languageSummary
  const evidenceScreenshots = report?.evidenceScreenshots || []
  const priorityActionPlan = report?.priorityActionPlan || report?.actionList || []

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


  if (job.status === 'processing' || job.status === 'pending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Waiting for analysis results to populate...</p>
          <Button variant="outline" size="sm" onClick={() => navigate(`/processing/${id}`)}>
            View Progress
          </Button>
        </div>
      </div>
    )
  }

  // Render main content
  return (
    <div className="min-h-screen bg-background pb-20">

      {/* Top Navigation */}
      <header className="sticky top-14 lg:top-0 z-30 flex min-h-16 flex-col items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md md:flex-row md:px-6">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {user && (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Back</span>
              </Button>
            </Link>
          )}
          {!user && (
            <Link to="/dashboard">
              <div className="flex items-center gap-2 mr-4 hover:opacity-80 transition-opacity">
                <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
                <span className="font-bold text-sm hidden sm:inline">YourIntAI</span>
              </div>
            </Link>
          )}
          {(user || !user) && <div className="hidden md:block w-px h-6 bg-border mx-1"></div>}
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">{job.title}</h1>
            <p className="text-[10px] text-muted-foreground truncate max-w-[150px] sm:max-w-[300px]">{job.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {isOwner && (
            <Button
              variant={job.is_public ? "secondary" : "outline"}
              size="sm"
              onClick={handleShare}
              className="h-8 text-xs gap-1.5"
            >
              <Share2 className={cn("h-3.5 w-3.5", job.is_public && "text-success")} />
              {job.is_public ? 'Shared' : 'Share'}
            </Button>
          )}
          {!isOwner && job.is_public && (
            <Badge variant="outline" className="h-8 gap-1.5 border-success/25 bg-success/10 text-success">
              <Share2 className="h-3 w-3" />
              Public Report
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isExporting} className="h-8 text-xs">
            {isExporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
            Export
          </Button>
          {job.report && (
            <Button variant="outline" size="sm" onClick={handleToggleLanguage} disabled={isTranslating} className="h-8 text-xs">
              {isTranslating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Languages className="h-3 w-3 mr-1" />}
              {reportLanguage === 'nl' ? 'English' : 'Dutch'}
            </Button>
          )}
          <a href={job.url.startsWith('http') ? job.url : `https://${job.url}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8" ref={reportRef}>

        {/* OVERVIEW HERO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="overflow-hidden border-[hsl(var(--ink-700))] bg-[hsl(var(--ink-950))] text-white shadow-overlay">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                <div className="flex-1 w-full">
                  <Badge className="mb-4 border-none bg-success/20 text-teal-100 hover:bg-success/25">Evidence ready</Badge>
                  {reportLanguage === 'nl' && (
                    <Badge className="mb-4 ml-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 border-none">Dutch Version</Badge>
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Audit Overview</h2>
                  <p className="text-slate-200 leading-relaxed text-base md:text-lg opacity-90">
                    {report?.overview || "No overview available for this audit."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-4 text-[10px] md:text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-teal-300" />
                      <span>Verified on {new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-400" />
                      <span>{report?.sections?.length || 0} Key Areas Analyzed</span>
                    </div>
                  </div>
                </div>

                {/* Score Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 flex flex-col items-center justify-center w-full md:min-w-[200px] md:w-auto border border-white/10 mt-4 md:mt-0">
                  <span className="text-slate-300 text-sm font-medium mb-2">Audit Score</span>
                  <div className="text-4xl md:text-5xl font-bold text-white mb-1">
                    {job.status === 'completed' ? auditScore : 0}
                    <span className="text-lg text-slate-400 font-normal">/100</span>
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-2">
                    <div className="h-1.5 rounded-full bg-teal-400" style={{ width: `${job.status === 'completed' ? auditScore : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {(criticalIssues.length > 0 || keyFindings.length > 0 || languageSummary) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {criticalIssues.length > 0 && (
              <Card className="border-red-100 dark:border-red-900 bg-white dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4" />
                    Critical Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {criticalIssues.slice(0, 5).map((issue, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {keyFindings.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Key Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                    {keyFindings.slice(0, 5).map((finding, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {languageSummary && (
              <Card className="border-blue-100 dark:border-blue-900 bg-white dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-blue-600" />
                    Localization Signals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {languageSummary.overallLocalizationRisk && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Risk:</span>
                      <Badge variant="outline" className="capitalize">{String(languageSummary.overallLocalizationRisk)}</Badge>
                    </div>
                  )}
                  {typeof languageSummary.languageSwitcherFound === 'boolean' && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Language switcher:</span>
                      <span className="font-medium">{languageSummary.languageSwitcherFound ? 'Found' : 'Not found'}</span>
                    </div>
                  )}
                  {languageSummary.primaryLanguagesDetected?.length ? (
                    <div>
                      <p className="text-muted-foreground mb-1">Languages detected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {languageSummary.primaryLanguagesDetected.map((language) => (
                          <Badge key={language} variant="secondary">{language}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {languageSummary.machineTranslationSignals?.length ? (
                    <div>
                      <p className="text-muted-foreground mb-1">Machine translation signals</p>
                      <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                        {languageSummary.machineTranslationSignals.slice(0, 3).map((signal, index) => (
                          <li key={index}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
                          <AccordionContent className="pt-0 pb-4 pl-4 md:pl-8">
                            <div className="space-y-3 text-sm text-muted-foreground">
                              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                                <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Analysis:</p>
                                <p>{finding.explanation}</p>
                                {finding.verificationNote && (
                                  <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                                    📋 {finding.verificationNote}
                                  </p>
                                )}
                                {/* Enhanced source location display */}
                                {(finding.sourceUrl || finding.sourceSection || finding.sourceSnippet) && (
                                  <div className="mt-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-md space-y-1.5">
                                    {finding.sourceUrl && (
                                      <a
                                        href={finding.sourceUrl.startsWith('http') ? finding.sourceUrl : `${job?.url}${finding.sourceUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                        🔗 Source: {finding.sourceUrl}
                                      </a>
                                    )}
                                    {finding.sourceSection && (
                                      <p className="text-xs text-slate-600 dark:text-slate-400">
                                        📍 Section: <span className="font-medium">{finding.sourceSection}</span>
                                      </p>
                                    )}
                                    {finding.sourceSnippet && (
                                      <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                        "{finding.sourceSnippet}"
                                      </p>
                                    )}
                                    {finding.confidence && (
                                      <p className="text-xs text-slate-500">
                                        🎯 Confidence: <span className={`font-medium ${finding.confidence >= 80 ? 'text-green-600' : finding.confidence >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>{finding.confidence}%</span>
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                              {finding.screenshotUrl && (
                                <a
                                  href={finding.screenshotUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                                >
                                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                    <Camera className="h-3.5 w-3.5" />
                                    Evidence screenshot
                                  </div>
                                  <img
                                    src={finding.screenshotUrl}
                                    alt={`Evidence for ${finding.problem}`}
                                    className="max-h-72 w-full object-contain bg-white"
                                    loading="lazy"
                                  />
                                </a>
                              )}
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

            {!isDeepAudit && legacyIssues && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  This is a legacy report format. Findings are listed below.
                  {/* Fallback for legacy issues rendering if needed */}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN: SIDEBAR */}
          <div className="space-y-6">
            {/* ACTION PLAN */}
            <div className="space-y-2">
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
                      {priorityActionPlan.map((action, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm group">
                          <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-white transition-colors cursor-pointer hover:bg-indigo-600 hover:border-indigo-600">
                          </div>
                          <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{action}</span>
                        </li>
                      ))}
                      {priorityActionPlan.length === 0 && (
                        <li className="text-sm text-muted-foreground italic">No specific actions generated.</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {(evidenceScreenshots.length > 0 || report?.agentTraceUrl) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      Browser evidence
                    </CardTitle>
                    <CardDescription>Sources and agent activity used to support this audit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {report?.agentTraceUrl && (
                      <a
                        href={report.agentTraceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <span>Agent trace</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {evidenceScreenshots.length === 0 && report?.agentTraceUrl && (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
                        No static screenshot URL was returned for this run. Use the agent trace above to review the evidence.
                      </p>
                    )}
                    {evidenceScreenshots.slice(0, 4).map((item, index) => (
                      <a
                        key={`${item.url}-${index}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <div className="px-3 py-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label || `Evidence ${index + 1}`}</p>
                          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                        </div>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

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

                      {report.companyInfo.industry && report.companyInfo.industry !== 'Not found' && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Industry:</span>
                          <span className="font-medium text-right">{report.companyInfo.industry}</span>
                        </div>
                      )}

                      {report.companyInfo.hq_location && report.companyInfo.hq_location !== 'Not found' && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">HQ:</span>
                          <span className="font-medium text-right">{report.companyInfo.hq_location}</span>
                        </div>
                      )}

                      {report.companyInfo.founded && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Founded:</span>
                          <span className="font-medium text-right">{report.companyInfo.founded}</span>
                        </div>
                      )}

                      {report.companyInfo.employees && report.companyInfo.employees !== 'Not found' && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Size:</span>
                          <span className="font-medium text-right">{report.companyInfo.employees}</span>
                        </div>
                      )}

                      {report.companyInfo.revenue && report.companyInfo.revenue !== 'Not found' && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Revenue:</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 font-semibold text-right">{report.companyInfo.revenue}</span>
                        </div>
                      )}

                      {report.companyInfo.email && !report.companyInfo.email.toLowerCase().includes('not found') && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email:</span>
                          <span className="font-medium text-right underline underline-offset-2">
                            <a href={`mailto:${report.companyInfo.email}`}>{report.companyInfo.email}</a>
                          </span>
                        </div>
                      )}

                      {report.companyInfo.phone && !report.companyInfo.phone.toLowerCase().includes('not found') && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone:</span>
                          <span className="font-medium text-right">
                            <a href={`tel:${report.companyInfo.phone}`}>{report.companyInfo.phone}</a>
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* LEADERSHIP & CONTACTS */}
            {/* LEADERSHIP & CONTACTS */}
            {(() => {
              const validContacts = report?.companyInfo?.contacts?.filter(c =>
                c.name &&
                !c.name.toLowerCase().includes('not found') &&
                c.name.trim().length > 0
              ) || []

              if (validContacts.length === 0) return null

              return (
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
                        {validContacts.map((contact, idx) => (
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
                              {(!contact.title || contact.title === 'Not found') ? 'Role not identified' : contact.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })()}

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

        </div>

      </main>
    </div>
  )
}
