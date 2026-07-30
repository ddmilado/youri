import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Copy, ExternalLink, Image as ImageIcon, Loader2, Mail, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { getJobById, getLeadById, updateJob, updateLead, type AuditSection, type CompanyInfo, type Contact } from '@/lib/supabase'

type Finding = AuditSection['findings'][number]

function severityRank(severity?: string) {
    if (severity === 'high') return 0
    if (severity === 'medium') return 1
    if (severity === 'low') return 2
    return 3
}

function cleanValue(value?: string | null) {
    if (!value) return ''
    if (value.toLowerCase().includes('not found')) return ''
    return value.trim()
}

function firstName(contact?: Contact) {
    const name = cleanValue(contact?.name)
    return name ? name.split(/\s+/)[0] : ''
}

function collectFindings(sections?: AuditSection[]) {
    return (sections || [])
        .flatMap((section) => (section.findings || []).map((finding) => ({ ...finding, sectionTitle: section.title })))
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function isProbablyImageUrl(url?: string | null) {
    if (!url) return false
    return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) || url.includes('screenshot') || url.includes('image')
}

export function LeadEmailPage() {
    const { id } = useParams<{ id: string }>()
    const queryClient = useQueryClient()
    const [isPreparingSend, setIsPreparingSend] = useState(false)

    const { data: lead, isLoading: isLoadingLead } = useQuery({
        queryKey: ['lead', id],
        queryFn: () => id ? getLeadById(id) : Promise.resolve(null),
        enabled: !!id,
    })

    const { data: job, isLoading: isLoadingJob } = useQuery({
        queryKey: ['job', lead?.job_id],
        queryFn: () => (lead?.job_id ? getJobById(lead.job_id) : Promise.resolve(null)),
        enabled: !!lead?.job_id,
    })

    const emailData = useMemo(() => {
        const companyInfo = (lead?.company_data || job?.report?.companyInfo || { contacts: [] }) as Partial<CompanyInfo>
        const contacts = (companyInfo.contacts || []) as Contact[]
        const primaryContact = contacts.find((contact) => cleanValue(contact.email)) || contacts[0]
        const recipient = cleanValue(primaryContact?.email) || cleanValue(companyInfo.email)
        const greetingName = firstName(primaryContact)
        const companyName = lead?.company_name || companyInfo.name || lead?.title || 'your company'
        const website = lead?.url || job?.url || ''
        const reportUrl = job ? `${window.location.origin}/report/${job.id}` : ''
        const findings = collectFindings(job?.report?.sections)
        const strongestFinding = findings[0] as (Finding & { sectionTitle?: string }) | undefined
        const issueTitle = strongestFinding?.problem || 'a localization issue that may affect international customers'
        const issueSnippet = cleanValue(strongestFinding?.sourceSnippet)
        const issueExplanation = cleanValue(strongestFinding?.explanation)
        const evidenceUrl = strongestFinding?.screenshotUrl
            || job?.report?.evidenceScreenshots?.find((item) => item.url)?.url
            || job?.screenshot_url
            || job?.report?.agentTraceUrl
            || ''

        const subject = `Quick tip about your international website - ${companyName}`
        const body = [
            `Hi ${greetingName || `${companyName} team`},`,
            '',
            `I was just on your website (${website}) and noticed that you're clearly investing in international growth. Great to see.`,
            '',
            `One thing stood out in the audit: ${issueTitle}.`,
            issueSnippet ? `Example from the site: "${issueSnippet}"` : '',
            issueExplanation ? `Why it matters: ${issueExplanation}` : '',
            '',
            `I put the short audit here: ${reportUrl}`,
            evidenceUrl ? `Evidence/replay: ${evidenceUrl}` : '',
            '',
            `From our work with performance and ecommerce brands, we know these details can directly affect conversion rates, customer trust, and how professional a site feels to international buyers.`,
            '',
            `I help companies identify and fix these localization leaks before they cost sales.`,
            '',
            `Would it be useful if I did a completely free review of 3 pages and sent you the clearest improvement opportunities?`,
            '',
            'Best,',
            lead?.creator_name || ''
        ].filter((line) => line !== '').join('\n')

        return {
            recipient,
            subject,
            body,
            reportUrl,
            evidenceUrl,
            companyName,
            website,
            strongestFinding,
            isEvidenceImage: isProbablyImageUrl(evidenceUrl)
        }
    }, [lead, job])

    const handleCopy = async (text: string, label: string) => {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied`)
    }

    const handleOpenEmail = async () => {
        if (!lead) return
        setIsPreparingSend(true)
        try {
            if (job && !job.is_public) {
                const shouldShare = window.confirm('This report is private. Make it public before adding it to the email?')
                if (shouldShare) {
                    await updateJob(job.id, { is_public: true })
                    queryClient.invalidateQueries({ queryKey: ['job', job.id] })
                    toast.success('Report is now public')
                }
            }

            await updateLead(lead.id, { status: 'contacted' })
            queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
            queryClient.invalidateQueries({ queryKey: ['leads'] })

            const mailto = `mailto:${encodeURIComponent(emailData.recipient || '')}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`
            window.location.href = mailto
        } catch (error) {
            console.error('Email preparation failed:', error)
            toast.error('Could not prepare email')
        } finally {
            setIsPreparingSend(false)
        }
    }

    if (isLoadingLead || isLoadingJob) {
        return (
            <div className="app-page flex min-h-[40rem] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!lead) {
        return <div className="app-page p-8 text-center">Lead not found</div>
    }

    return (
        <div className="app-page">
            <header className="app-header">
                <div>
                    <Link to={`/leads/${lead.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to lead
                    </Link>
                    <p className="eyebrow">Outreach</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Email draft for {emailData.companyName}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Generated from the audit report, strongest localization issue, and report evidence.
                    </p>
                </div>
                <div className="surface-panel flex w-full items-center gap-3 p-3 md:w-auto">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary/10 text-secondary">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{lead.status}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                            Added {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                <Card>
                    <CardHeader>
                        <CardTitle>Email</CardTitle>
                        <CardDescription>Review and adjust before sending from your email client.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">To</label>
                            <Input value={emailData.recipient || 'No email found - add recipient manually'} readOnly />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Subject</label>
                            <Input value={emailData.subject} readOnly />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Body</label>
                            <Textarea value={emailData.body} readOnly className="min-h-[26rem] font-mono text-sm leading-relaxed" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleOpenEmail} disabled={isPreparingSend}>
                                {isPreparingSend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Open Email
                            </Button>
                            <Button variant="outline" onClick={() => handleCopy(emailData.body, 'Email body')}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Body
                            </Button>
                            <Button variant="outline" onClick={() => handleCopy(emailData.subject, 'Subject')}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Subject
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                Audit Context
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            {job ? (
                                <>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Report</span>
                                        <Badge variant={job.is_public ? 'secondary' : 'outline'}>{job.is_public ? 'Public' : 'Private'}</Badge>
                                    </div>
                                    <a href={emailData.reportUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                                        <span>Open report</span>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                    {emailData.strongestFinding && (
                                        <div className="rounded-md border p-3">
                                            <p className="font-medium">{emailData.strongestFinding.problem}</p>
                                            <p className="mt-2 text-muted-foreground">{emailData.strongestFinding.sourceSnippet || emailData.strongestFinding.explanation}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted-foreground">No linked audit report found.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ImageIcon className="h-4 w-4 text-blue-600" />
                                Evidence Image
                            </CardTitle>
                            <CardDescription>Included as a link in the email body.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {emailData.evidenceUrl ? (
                                <a href={emailData.evidenceUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border hover:bg-muted/40">
                                    {emailData.isEvidenceImage ? (
                                        <img src={emailData.evidenceUrl} alt="Audit evidence" className="max-h-64 w-full object-contain bg-white" />
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 p-3 text-sm">
                                            <span>Open evidence or replay</span>
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </a>
                            ) : (
                                <p className="text-sm text-muted-foreground">No screenshot or replay evidence is attached to this report yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
