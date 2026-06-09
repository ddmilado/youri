// Run Workflow - Main Entry Point
// Two-Phase Architecture: Phase 1 (Crawl) -> Phase 2 (Analysis)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { executeAuditWorkflow, JobReport } from './agents.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

class ConcurrencyLimiter {
    public activeRequests = 0
    private readonly maxConcurrent = 5
    private queue: Array<() => void> = []

    async acquire(): Promise<void> {
        if (this.activeRequests < this.maxConcurrent) {
            this.activeRequests++
            return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
            this.queue.push(resolve)
        })
    }

    release(): void {
        this.activeRequests--
        if (this.queue.length > 0) {
            const next = this.queue.shift()
            if (next) {
                this.activeRequests++
                next()
            }
        }
    }
}

const concurrencyLimiter = new ConcurrencyLimiter()

interface WorkflowInput {
    input_as_text: string
    user_id: string
    job_id?: string
    is_callback?: boolean // Flag to indicate completion of Phase 1
}

type BrowserUseSession = {
    id?: string
    sessionId?: string
    session_id?: string
    status?: string
    liveUrl?: string
    live_url?: string
    replayUrl?: string
    replay_url?: string
    output?: unknown
    result?: unknown
    finalOutput?: unknown
    final_output?: unknown
    outputJson?: unknown
    output_json?: unknown
    [key: string]: unknown
}

type BrowserUseFinding = {
    problem?: string
    explanation?: string
    recommendation?: string
    severity?: string
    sourceUrl?: string
    sourceSection?: string
    sourceSnippet?: string
    confidence?: number
    verificationNote?: string
    screenshotUrl?: string
    impact?: string
}

type BrowserUseAuditReport = JobReport & {
    criticalIssues?: string[]
    keyFindings?: string[]
    priorityActionPlan?: string[]
    languageSummary?: Record<string, unknown>
    evidenceScreenshots?: Array<{
        label: string
        url: string
        description?: string
    }>
    browserUseSessionId?: string
    browserUseLiveUrl?: string
}

const browserUseApiBase = 'https://api.browser-use.com/api/v3'

function normalizeUrl(input: string): string {
    const trimmed = input.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

function getLowercaseCountryCode(value: string | undefined, fallback: string): string {
    return (value || fallback).trim().toLowerCase()
}

function safeInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value || '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function safeNumber(value: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(value || '')
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function getBrowserUseSessionId(session: BrowserUseSession): string | undefined {
    const sessionId = session.id || session.sessionId || session.session_id
    return typeof sessionId === 'string' && sessionId ? sessionId : undefined
}

function getBrowserUseLiveUrl(session: BrowserUseSession): string | undefined {
    const liveUrl = session.liveUrl || session.live_url || session.replayUrl || session.replay_url
    return typeof liveUrl === 'string' && liveUrl ? liveUrl : undefined
}

function getBrowserUseErrorDetails(session: BrowserUseSession): string {
    const record = session as Record<string, unknown>
    const possibleDetails = [
        record.error,
        record.errors,
        record.message,
        record.detail,
        record.failureReason,
        record.failure_reason,
        record.statusMessage,
        record.status_message
    ].filter(Boolean)

    if (possibleDetails.length === 0) return `Browser Use audit failed with status: ${session.status || 'unknown'}`

    return possibleDetails.map((detail) => {
        if (typeof detail === 'string') return detail
        try { return JSON.stringify(detail) } catch { return String(detail) }
    }).join(' | ')
}

function calculateReportScore(report: BrowserUseAuditReport): number {
    if (typeof report.score === 'number') return Math.max(0, Math.min(100, Math.round(report.score)))

    let score = 100
    for (const section of report.sections || []) {
        for (const finding of section.findings || []) {
            const severity = finding.severity?.toLowerCase()
            if (severity === 'high' || severity === 'critical') score -= 10
            else if (severity === 'medium') score -= 5
            else if (severity === 'low') score -= 2
        }
    }

    return Math.max(0, Math.min(100, score))
}

function findReportCandidate(value: unknown, depth = 0): unknown {
    if (!value || depth > 8) return null

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return null

        try {
            return findReportCandidate(JSON.parse(trimmed), depth + 1)
        } catch {
            const firstBrace = trimmed.indexOf('{')
            const lastBrace = trimmed.lastIndexOf('}')
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                try {
                    return findReportCandidate(JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)), depth + 1)
                } catch {
                    return null
                }
            }
            return null
        }
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const candidate = findReportCandidate(item, depth + 1)
            if (candidate) return candidate
        }
        return null
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        if (Array.isArray(record.sections) && typeof record.overview === 'string') return record
        if (record.report) {
            const candidate = findReportCandidate(record.report, depth + 1)
            if (candidate) return candidate
        }
        if (record.output) {
            const candidate = findReportCandidate(record.output, depth + 1)
            if (candidate) return candidate
        }
        if (record.result) {
            const candidate = findReportCandidate(record.result, depth + 1)
            if (candidate) return candidate
        }
        if (record.finalOutput) {
            const candidate = findReportCandidate(record.finalOutput, depth + 1)
            if (candidate) return candidate
        }
        if (record.final_output) {
            const candidate = findReportCandidate(record.final_output, depth + 1)
            if (candidate) return candidate
        }
        if (record.outputJson) {
            const candidate = findReportCandidate(record.outputJson, depth + 1)
            if (candidate) return candidate
        }
        if (record.output_json) {
            const candidate = findReportCandidate(record.output_json, depth + 1)
            if (candidate) return candidate
        }
    }

    return null
}

function normalizeBrowserUseReport(candidate: unknown, targetUrl: string, session: BrowserUseSession): BrowserUseAuditReport {
    const raw = candidate as Partial<BrowserUseAuditReport> | null
    if (!raw || !Array.isArray(raw.sections)) {
        throw new Error('Browser Use output did not contain a valid audit report')
    }

    const sections = raw.sections.map((section) => ({
        title: section.title || 'Audit Findings',
        findings: (section.findings || []).map((finding: BrowserUseFinding) => ({
            problem: finding.problem || 'Issue identified',
            explanation: finding.explanation || finding.impact || 'The audit identified a localization or conversion risk on this page.',
            recommendation: finding.recommendation || 'Review and rewrite this item for the target market.',
            severity: ['high', 'medium', 'low'].includes((finding.severity || '').toLowerCase())
                ? (finding.severity!.toLowerCase() as 'high' | 'medium' | 'low')
                : 'medium',
            sourceUrl: finding.sourceUrl || targetUrl,
            sourceSection: finding.sourceSection,
            sourceSnippet: finding.sourceSnippet,
            confidence: typeof finding.confidence === 'number' ? finding.confidence : undefined,
            verificationNote: finding.verificationNote || 'Verified during the Browser Use live website audit.',
            screenshotUrl: finding.screenshotUrl,
            impact: finding.impact
        }))
    }))

    const sessionId = getBrowserUseSessionId(session)
    const liveUrl = getBrowserUseLiveUrl(session)
    const companyInfo = raw.companyInfo || {
        name: (() => {
            try { return new URL(targetUrl).hostname.replace(/^www\./, '') } catch { return targetUrl }
        })(),
        contacts: []
    }

    const report: BrowserUseAuditReport = {
        overview: raw.overview || `Localization and conversion audit for ${targetUrl}.`,
        sections,
        conclusion: raw.conclusion || 'The website audit is complete. Prioritize the highest severity language, trust, and legal-discoverability issues first.',
        actionList: raw.actionList || raw.priorityActionPlan || [],
        companyInfo: {
            ...companyInfo,
            contacts: companyInfo.contacts || []
        },
        score: calculateReportScore({ ...raw, sections } as BrowserUseAuditReport),
        criticalIssues: raw.criticalIssues || [],
        keyFindings: raw.keyFindings || [],
        priorityActionPlan: raw.priorityActionPlan || raw.actionList || [],
        languageSummary: raw.languageSummary,
        evidenceScreenshots: raw.evidenceScreenshots || [],
        browserUseSessionId: sessionId,
        browserUseLiveUrl: liveUrl
    }

    return report
}

async function saveBrowserUseAuditReport(
    supabaseClient: any,
    jobId: string,
    targetUrl: string,
    session: BrowserUseSession,
    reportCandidate: unknown,
    statusChannel?: any
): Promise<BrowserUseAuditReport> {
    const report = normalizeBrowserUseReport(reportCandidate, targetUrl, session)
    const sessionId = getBrowserUseSessionId(session)
    const liveUrl = getBrowserUseLiveUrl(session) || report.browserUseLiveUrl
    const screenshotUrl = report.evidenceScreenshots?.find((item) => item.url)?.url || liveUrl || null
    const safeScore = calculateReportScore(report)

    const finalReport: BrowserUseAuditReport = {
        ...report,
        score: safeScore,
        browserUseSessionId: sessionId || report.browserUseSessionId,
        browserUseLiveUrl: liveUrl || report.browserUseLiveUrl
    }

    await supabaseClient.from('jobs').update({
        status: 'completed',
        report: finalReport,
        status_message: 'Audit completed!',
        completed_at: new Date().toISOString(),
        score: safeScore,
        screenshot_url: screenshotUrl,
        raw_data: {
            source: 'browser-use',
            session_id: sessionId || report.browserUseSessionId,
            live_url: liveUrl || report.browserUseLiveUrl,
            target_url: targetUrl,
            completed_at: new Date().toISOString()
        }
    }).eq('id', jobId)

    if (statusChannel) {
        await statusChannel.send({
            type: 'broadcast',
            event: 'status_update',
            payload: { message: 'Audit completed!', status: 'completed', id: jobId }
        }, { httpSend: true }).catch((broadcastError: unknown) => {
            console.error('Failed to broadcast Browser Use completion:', broadcastError)
        })
    }

    return finalReport
}

function buildBrowserUseAuditTask(targetUrl: string): string {
    return `
You are performing a live browser-based website audit for: ${targetUrl}

Default output language: English.

Audit objective:
Assess whether this website is ready for international customers, especially German and English-speaking buyers. Focus on linguistic quality, poor localization, legal/trust discoverability, and conversion risks.

Visit and verify:
- Homepage and main navigation.
- Language switcher, country selector, or locale-specific pages if present.
- German pages, English pages, partially German/English pages, and mixed-language content.
- Shipping/delivery page, returns/withdrawal page, terms and conditions/AGB, privacy/GDPR, contact, Impressum/legal notice, FAQ, and checkout/cart flow if safely possible without purchasing.
- Important footer links and trust/social-proof areas.

Find and document:
- Grammar, spelling, awkward phrasing, literal machine translation, unnatural localization, language mixing, and inconsistent terminology.
- German market readiness issues: missing/weak Impressum, unclear AGB/terms, unclear Widerrufsrecht/returns, unclear German shipping costs, weak German social proof, lack of local trust cues.
- UX and conversion trust killers: broken links, poor discoverability of legal/shipping/returns info, inconsistent language, weak market positioning, unclear checkout expectations.
- Machine translation signals, including language-switcher behavior, partially translated templates, mixed untranslated labels, and literal translations.

For each issue, explain:
- What is wrong.
- Why it is linguistically incorrect, awkward, legally/trust-relevant, or conversion-damaging.
- Why it matters for international/German customers.
- What to fix.
- The exact page URL, page area, short text snippet, confidence, and verification note.
- Capture visual evidence for at least one concrete high/medium-severity problem if Browser Use exposes screenshot or evidence URLs.
- Put that URL in finding.screenshotUrl and evidenceScreenshots. If no static screenshot URL is available, omit screenshotUrl and make the verification note specific enough that the Browser Use replay can be used as evidence.

Return ONLY valid JSON matching this shape:
{
  "overview": "executive summary paragraph",
  "companyInfo": {
    "name": "company or website name",
    "industry": "industry if identifiable",
    "hq_location": "location if identifiable",
    "employees": "employee estimate or Not found",
    "revenue": "revenue estimate or Not found",
    "email": "email or Not found",
    "phone": "phone or Not found",
    "contacts": []
  },
  "languageSummary": {
    "primaryLanguagesDetected": ["English", "German"],
    "targetMarketsDetected": ["Germany", "United Kingdom", "Europe"],
    "languageSwitcherFound": true,
    "machineTranslationSignals": ["short signal strings"],
    "overallLocalizationRisk": "low | medium | high"
  },
  "criticalIssues": ["short critical issue strings"],
  "keyFindings": ["short key finding strings"],
  "sections": [
    {
      "title": "Linguistic & Localization Errors",
      "findings": [
        {
          "problem": "short issue title",
          "explanation": "detailed explanation of the mistake and its trust/conversion impact",
          "recommendation": "specific fix",
          "severity": "high | medium | low",
          "sourceUrl": "exact page URL",
          "sourceSection": "page area",
          "sourceSnippet": "short exact snippet",
          "confidence": 0,
          "verificationNote": "how you verified it",
          "screenshotUrl": "optional screenshot/evidence URL"
        }
      ]
    }
  ],
  "actionList": ["priority next steps"],
  "priorityActionPlan": ["same or more detailed priority steps"],
  "evidenceScreenshots": [
    {"label": "short label", "url": "screenshot/evidence URL when available", "description": "what it proves"}
  ],
  "conclusion": "short closing paragraph",
  "score": 0
}

Use these required section titles when relevant:
- Executive Summary & Company Context
- Linguistic & Localization Errors
- German Market Trust & Legal Readiness
- Shipping, Returns & Checkout Clarity
- UX Conversion Trust Killers
- Priority Recommendations

Be strict: return no Markdown, no commentary, no fenced code block, only JSON.
`
}

function buildBrowserUseOutputSchema() {
    return {
        type: 'object',
        additionalProperties: true,
        required: ['overview', 'sections', 'conclusion', 'actionList', 'score'],
        properties: {
            overview: { type: 'string' },
            companyInfo: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    name: { type: 'string' },
                    industry: { type: 'string' },
                    hq_location: { type: 'string' },
                    employees: { type: 'string' },
                    revenue: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    contacts: { type: 'array', items: { type: 'object', additionalProperties: true } }
                }
            },
            languageSummary: { type: 'object', additionalProperties: true },
            criticalIssues: { type: 'array', items: { type: 'string' } },
            keyFindings: { type: 'array', items: { type: 'string' } },
            sections: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['title', 'findings'],
                    properties: {
                        title: { type: 'string' },
                        findings: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['problem', 'explanation', 'recommendation', 'severity'],
                                additionalProperties: true,
                                properties: {
                                    problem: { type: 'string' },
                                    explanation: { type: 'string' },
                                    recommendation: { type: 'string' },
                                    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                                    sourceUrl: { type: 'string' },
                                    sourceSection: { type: 'string' },
                                    sourceSnippet: { type: 'string' },
                                    confidence: { type: 'number' },
                                    verificationNote: { type: 'string' },
                                    screenshotUrl: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            actionList: { type: 'array', items: { type: 'string' } },
            priorityActionPlan: { type: 'array', items: { type: 'string' } },
            evidenceScreenshots: {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        label: { type: 'string' },
                        url: { type: 'string' },
                        description: { type: 'string' }
                    }
                }
            },
            conclusion: { type: 'string' },
            score: { type: 'number' }
        }
    }
}

async function startBrowserUseAudit(apiKey: string, targetUrl: string): Promise<BrowserUseSession> {
    const model = Deno.env.get('BROWSER_USE_AUDIT_MODEL') || Deno.env.get('BROWSER_USE_MODEL') || 'bu-mini'
    const maxCostUsd = safeNumber(Deno.env.get('BROWSER_USE_AUDIT_MAX_COST_USD'), 8)
    const proxyCountryCode = getLowercaseCountryCode(Deno.env.get('BROWSER_USE_AUDIT_PROXY_COUNTRY') || Deno.env.get('BROWSER_USE_PROXY_COUNTRY'), 'de')

    const response = await fetch(`${browserUseApiBase}/sessions`, {
        method: 'POST',
        headers: {
            'X-Browser-Use-API-Key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            task: buildBrowserUseAuditTask(targetUrl),
            model,
            keepAlive: false,
            proxyCountryCode,
            maxCostUsd,
            outputSchema: buildBrowserUseOutputSchema()
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Browser Use API error: ${response.status} ${errorText}`)
    }

    return await response.json()
}

async function getBrowserUseSession(apiKey: string, sessionId: string): Promise<BrowserUseSession> {
    const response = await fetch(`${browserUseApiBase}/sessions/${sessionId}`, {
        headers: { 'X-Browser-Use-API-Key': apiKey }
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Browser Use session lookup error: ${response.status} ${errorText}`)
    }

    return await response.json()
}

async function pollBrowserUseAudit(apiKey: string, initialSession: BrowserUseSession, targetUrl: string, updateStatus: (message: string) => Promise<void>): Promise<{ session: BrowserUseSession; report: BrowserUseAuditReport }> {
    const sessionId = initialSession.id || initialSession.sessionId || initialSession.session_id
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('Browser Use session id missing')

    const attempts = safeInteger(Deno.env.get('BROWSER_USE_AUDIT_POLL_ATTEMPTS'), 72)
    const intervalMs = safeInteger(Deno.env.get('BROWSER_USE_AUDIT_POLL_INTERVAL_MS'), 5000)
    let latest: BrowserUseSession = initialSession

    for (let attempt = 0; attempt < attempts; attempt++) {
        latest = await getBrowserUseSession(apiKey, sessionId)
        const status = String(latest.status || '').toLowerCase()
        const reportCandidate = findReportCandidate(latest)

        if (reportCandidate) {
            return { session: latest, report: normalizeBrowserUseReport(reportCandidate, targetUrl, latest) }
        }

        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
            throw new Error(getBrowserUseErrorDetails(latest))
        }

        if (attempt % 6 === 0) {
            await updateStatus(`Browser Use audit running... (${Math.round((attempt * intervalMs) / 1000)}s)`)
        }
        await sleep(intervalMs)
    }

    throw new Error('Browser Use audit did not return a report before the polling timeout')
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let jobIdForFailure: string | undefined
    let supabaseForFailure: any = null

    try {
        const body = await req.json() as WorkflowInput
        const { input_as_text, user_id, job_id: providedJobId, is_callback } = body

        let jobId = providedJobId
        jobIdForFailure = providedJobId

        if (!input_as_text) throw new Error('input_as_text is required')
        if (!user_id) throw new Error('user_id is required')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        supabaseForFailure = supabaseClient

        // Extract URL
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)
        const targetUrl = normalizeUrl(urlMatch ? urlMatch[1] : input_as_text)

        // 1. Job Management
        if (!jobId) {
            let jobTitle = targetUrl
            try { jobTitle = new URL(targetUrl).hostname } catch (e) { }

            const { data: job, error: jobError } = await supabaseClient.from('jobs').insert({
                user_id, title: jobTitle, url: targetUrl, status: 'pending', status_message: 'Initializing...'
            }).select().single()

            if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)
            jobId = job.id
            jobIdForFailure = job.id
        }

        if (!jobId) {
            throw new Error('job_id is required or could not be created')
        }

        const { data: currentJob, error: currentJobError } = await supabaseClient
            .from('jobs')
            .select('raw_data, crawl_status, status, report')
            .eq('id', jobId)
            .single()

        if (currentJobError || !currentJob) {
            throw new Error(`Job not found or unavailable: ${currentJobError?.message || jobId}`)
        }

        const browserUseApiKey = Deno.env.get('BROWSER_USE_API_KEY')
        const browserUseUrlAuditsEnabled = !!browserUseApiKey && Deno.env.get('BROWSER_USE_FOR_URL_AUDITS') !== 'false'
        const browserUseRawData = currentJob.raw_data as Record<string, unknown> | null
        const existingBrowserUseSessionId = browserUseRawData?.source === 'browser-use' && typeof browserUseRawData.session_id === 'string'
            ? browserUseRawData.session_id
            : undefined

        if (browserUseUrlAuditsEnabled && existingBrowserUseSessionId && (is_callback || currentJob.status === 'processing')) {
            const session = await getBrowserUseSession(browserUseApiKey!, existingBrowserUseSessionId)
            const reportCandidate = findReportCandidate(session)
            const sessionStatus = String(session.status || '').toLowerCase()

            if (reportCandidate) {
                await saveBrowserUseAuditReport(supabaseClient, jobId, targetUrl, session, reportCandidate)
                return new Response(JSON.stringify({
                    success: true,
                    job_id: jobId,
                    phase: 'browser-use-completed',
                    message: 'Browser Use audit report saved.'
                }), { headers: corsHeaders })
            }

            if (['failed', 'error', 'cancelled', 'canceled'].includes(sessionStatus)) {
                const errorMessage = getBrowserUseErrorDetails(session)
                await supabaseClient.from('jobs').update({
                    status: 'failed',
                    status_message: `Browser Use audit failed: ${errorMessage.substring(0, 120)}`,
                    raw_data: {
                        ...browserUseRawData,
                        source: 'browser-use',
                        session_id: existingBrowserUseSessionId,
                        last_status: session.status,
                        error: errorMessage,
                        failed_at: new Date().toISOString()
                    }
                }).eq('id', jobId)

                return new Response(JSON.stringify({
                    success: false,
                    job_id: jobId,
                    phase: 'browser-use-failed',
                    error: errorMessage
                }), { headers: corsHeaders })
            }

            await supabaseClient.from('jobs').update({
                status: 'processing',
                status_message: `Browser Use audit still running (${session.status || 'in progress'})...`,
                raw_data: {
                    ...browserUseRawData,
                    source: 'browser-use',
                    session_id: existingBrowserUseSessionId,
                    last_status: session.status,
                    live_url: getBrowserUseLiveUrl(session) || browserUseRawData?.live_url,
                    last_checked_at: new Date().toISOString()
                }
            }).eq('id', jobId)

            return new Response(JSON.stringify({
                success: true,
                job_id: jobId,
                phase: 'browser-use-running',
                message: 'Browser Use audit is still running.'
            }), { headers: corsHeaders })
        }

        if (browserUseUrlAuditsEnabled && !is_callback) {
            console.log(`[Browser Use] Starting live URL audit for job ${jobId}`)

            const processBrowserUseAudit = (async () => {
                await concurrencyLimiter.acquire()
                const statusChannel = supabaseClient.channel(`job-status-${jobId}`)

                const updateStatus = async (msg: string) => {
                    console.log(`[Browser Use Status] ${msg}`)
                    await supabaseClient
                        .from('jobs')
                        .update({ status_message: msg, status: 'processing' })
                        .eq('id', jobId)

                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: msg, status: 'processing', id: jobId }
                    }, { httpSend: true }).catch((broadcastError: unknown) => {
                        console.error('Failed to broadcast Browser Use status:', broadcastError)
                    })
                }

                try {
                    await updateStatus('Starting Browser Use site audit...')

                    await supabaseClient.from('jobs').update({
                        status: 'processing',
                        status_message: 'Browser Use audit running...',
                        crawl_status: 'completed'
                    }).eq('id', jobId)

                    const initialSession = await startBrowserUseAudit(browserUseApiKey!, targetUrl)
                    const initialSessionId = initialSession.id || initialSession.sessionId || initialSession.session_id
                    const initialLiveUrl = initialSession.liveUrl || initialSession.live_url || initialSession.replayUrl || initialSession.replay_url

                    await supabaseClient.from('jobs').update({
                        status_message: 'Browser Use is visiting and auditing the website...',
                        raw_data: {
                            source: 'browser-use',
                            session_id: initialSessionId,
                            live_url: initialLiveUrl,
                            target_url: targetUrl,
                            started_at: new Date().toISOString()
                        }
                    }).eq('id', jobId)

                    await updateStatus('Browser Use is checking localization, legal pages, shipping, and conversion risks...')

                    const { session, report } = await pollBrowserUseAudit(browserUseApiKey!, initialSession, targetUrl, updateStatus)
                    await saveBrowserUseAuditReport(supabaseClient, jobId, targetUrl, session, report, statusChannel)
                } catch (error) {
                    console.error('Browser Use audit error:', error)
                    await supabaseClient.from('jobs').update({
                        status: 'failed',
                        status_message: `Browser Use audit failed: ${(error as Error).message.substring(0, 120)}`
                    }).eq('id', jobId)

                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: `Browser Use audit failed: ${(error as Error).message}`, status: 'failed', id: jobId }
                    }, { httpSend: true }).catch((broadcastError: unknown) => {
                        console.error('Failed to broadcast Browser Use failure:', broadcastError)
                    })
                } finally {
                    concurrencyLimiter.release()
                    await supabaseClient.removeChannel(statusChannel)
                }
            })()

            // @ts-ignore
            if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
                // @ts-ignore
                EdgeRuntime.waitUntil(processBrowserUseAudit)
            } else {
                processBrowserUseAudit.catch(e => console.error('Browser Use audit failure:', e))
            }

            return new Response(JSON.stringify({
                success: true,
                job_id: jobId,
                phase: 'browser-use-audit',
                message: 'Browser Use URL audit started.'
            }), { headers: corsHeaders })
        }

        // 2. Phase Detection (Crawl vs Analysis)
        const hasCrawlData = currentJob?.raw_data?.pages && currentJob.raw_data.pages.length > 0

        if (!hasCrawlData) {
            // PHASE 1: START CRAWL AND RETURN IMMEDIATELY
            console.log(`[Phase 1] Triggering crawler for job ${jobId}`)

            await supabaseClient.from('jobs').update({
                status: 'processing',
                status_message: 'Crawling website...',
                crawl_status: 'crawling'
            }).eq('id', jobId)

            const crawlerTrigger = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crawler`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ job_id: jobId, url: targetUrl, user_id: user_id })
            }).then(async (response) => {
                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('Crawler trigger failed:', errorText)
                    await supabaseClient.from('jobs').update({
                        status: 'failed',
                        crawl_status: 'failed',
                        status_message: `Crawler failed to start: ${errorText.substring(0, 120)}`
                    }).eq('id', jobId)
                }
            }).catch(async (e) => {
                console.error('Crawler trigger failed:', e)
                await supabaseClient.from('jobs').update({
                    status: 'failed',
                    crawl_status: 'failed',
                    status_message: `Crawler failed to start: ${(e as Error).message.substring(0, 120)}`
                }).eq('id', jobId)
            })

            // @ts-ignore
            if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
                // @ts-ignore
                EdgeRuntime.waitUntil(crawlerTrigger)
            }

            return new Response(JSON.stringify({
                success: true,
                job_id: jobId,
                phase: 'crawling',
                message: 'Crawl phase started. Function will restart for analysis once crawl completes.'
            }), { headers: corsHeaders })
        }

        // PHASE 2: RUN AI ANALYSIS
        console.log(`[Phase 2] Starting AI analysis for job ${jobId}`)

        // Background processing for Phase 2
        const processPhase2 = (async () => {
            await concurrencyLimiter.acquire()
            const statusChannel = jobId ? supabaseClient.channel(`job-status-${jobId}`) : null

            const updateStatus = async (msg: string) => {
                console.log(`[Phase 2 Status] ${msg}`)
                await supabaseClient.from('jobs').update({ status_message: msg, status: 'processing' }).eq('id', jobId)
                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: msg, status: 'processing', id: jobId } }, { httpSend: true })
                }
            }

            try {
                const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
                if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')

                await updateStatus('Launching AI Auditors...')

                // Pass the structured crawl payload through to the agent workflow.
                // The agent runner prioritizes legal pages, contact data, and RAG verification from this shape.
                const contextData = currentJob.raw_data

                // Execute Audit
                const auditReport = await executeAuditWorkflow(
                    targetUrl,
                    contextData,
                    openaiApiKey,
                    updateStatus,
                    null, // No cached agent data initially
                    async (agentData) => {
                        await supabaseClient.from('jobs').update({ status_message: 'Compiling report...' }).eq('id', jobId)
                    },
                    jobId
                )

                if (!auditReport || !auditReport.sections) throw new Error('Invalid report structure')

                // Save Final Report
                const safeScore = typeof auditReport.score === 'number' ? auditReport.score : 0
                await supabaseClient.from('jobs').update({
                    status: 'completed',
                    report: auditReport,
                    status_message: 'Audit completed!',
                    completed_at: new Date().toISOString(),
                    score: safeScore
                }).eq('id', jobId)

                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: 'Audit completed!', status: 'completed', id: jobId } }, { httpSend: true })
                }

            } catch (error) {
                console.error('Phase 2 error:', error)
                await supabaseClient.from('jobs').update({
                    status: 'failed',
                    status_message: `Analysis failed: ${(error as Error).message.substring(0, 100)}`
                }).eq('id', jobId)
                if (statusChannel) {
                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: `Analysis failed: ${(error as Error).message}`, status: 'failed', id: jobId }
                    }, { httpSend: true }).catch((broadcastError: unknown) => {
                        console.error('Failed to broadcast analysis failure:', broadcastError)
                    })
                }
            } finally {
                concurrencyLimiter.release()
                if (statusChannel) await supabaseClient.removeChannel(statusChannel)
            }
        })()

        // Use waitUntil to keep function alive for Phase 2
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            // @ts-ignore
            EdgeRuntime.waitUntil(processPhase2)
        } else {
            processPhase2.catch(e => console.error('Phase 2 failure:', e))
        }

        return new Response(JSON.stringify({
            success: true,
            job_id: jobId,
            phase: 'analyzing',
            message: 'Analysis phase started.'
        }), { headers: corsHeaders })

    } catch (error) {
        console.error('Workflow error:', error)
        if (jobIdForFailure && supabaseForFailure) {
            await supabaseForFailure.from('jobs').update({
                status: 'failed',
                status_message: `Workflow failed: ${(error as Error).message.substring(0, 140)}`
            }).eq('id', jobIdForFailure).catch((statusError: unknown) => {
                console.error('Failed to persist workflow failure:', statusError)
            })
        }
        return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 200, headers: corsHeaders })
    }
})
