import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-browser-use-signature, x-browser-use-timestamp',
    'Content-Type': 'application/json',
}

interface BrowserUseWebhookPayload {
    type?: string
    timestamp?: string
    payload?: {
        task_id?: string
        session_id?: string
        status?: string
        metadata?: {
            workflow?: string
            search_id?: string
            user_id?: string
            search_query?: string
            creator_name?: string
            creator_email?: string
        }
    }
}

interface BrowserUseKeywordJob {
    session_id: string
    user_id: string
    search_id: string | null
    search_query: string
    creator_name: string | null
    creator_email: string | null
}

interface BrowserUseResult {
    company_name?: string
    companyName?: string
    website?: string
    url?: string
    company_description?: string
    companyDescription?: string
    category?: string
    shipping_evidence?: string
    shippingEvidence?: string
    revenue_evidence?: string
    revenueEvidence?: string
    revenue_estimate?: string
    revenueEstimate?: string
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value !== null && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce((acc, key) => {
                acc[key] = sortKeys((value as Record<string, unknown>)[key])
                return acc
            }, {} as Record<string, unknown>)
    }
    return value
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    return [...new Uint8Array(signature)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

async function verifyBrowserUseWebhook(rawBody: string, req: Request): Promise<boolean> {
    const secret = Deno.env.get('BROWSER_USE_WEBHOOK_SECRET')
    if (!secret) {
        throw new Error('BROWSER_USE_WEBHOOK_SECRET is not configured')
    }

    const signature = req.headers.get('X-Browser-Use-Signature') || req.headers.get('x-browser-use-signature')
    const timestamp = req.headers.get('X-Browser-Use-Timestamp') || req.headers.get('x-browser-use-timestamp')
    if (!signature || !timestamp) return false

    const timestampNumber = Number(timestamp)
    if (!Number.isFinite(timestampNumber)) return false
    if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false

    const payload = JSON.parse(rawBody)
    const sortedBody = JSON.stringify(sortKeys(payload))
    const expected = await hmacSha256Hex(`${timestamp}.${sortedBody}`, secret)

    return expected === signature
}

function normalizeUrl(url: string): string {
    const trimmed = url.trim()
    if (!trimmed) return trimmed
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function rootDomain(url: string): string {
    try {
        const parsed = new URL(normalizeUrl(url))
        return parsed.hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
        return url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
    }
}

function buildDescription(result: BrowserUseResult): string {
    const base = result.company_description || result.companyDescription || ''
    const details = [
        result.category ? `Category: ${result.category}.` : '',
        result.shipping_evidence || result.shippingEvidence ? `Shipping evidence: ${result.shipping_evidence || result.shippingEvidence}.` : '',
        result.revenue_evidence || result.revenueEvidence ? `Revenue signal: ${result.revenue_evidence || result.revenueEvidence}.` : '',
        result.revenue_estimate || result.revenueEstimate ? `Revenue estimate: ${result.revenue_estimate || result.revenueEstimate}.` : '',
    ].filter(Boolean)

    return [base, ...details].filter(Boolean).join(' ').slice(0, 2000)
}

function normalizeResults(results: BrowserUseResult[]) {
    const seenDomains = new Set<string>()

    return results.flatMap((result) => {
        const website = normalizeUrl(result.website || result.url || '')
        const companyName = result.company_name || result.companyName
        const domain = rootDomain(website)

        if (!website || !companyName || !domain || seenDomains.has(domain)) {
            return []
        }

        seenDomains.add(domain)

        return [{
            company_name: companyName.trim(),
            website,
            company_description: buildDescription(result),
        }]
    })
}

async function fetchBrowserUseSession(sessionId: string, apiKey: string) {
    const response = await fetch(`https://api.browser-use.com/api/v3/sessions/${sessionId}`, {
        headers: {
            'X-Browser-Use-API-Key': apiKey,
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Browser Use session fetch failed: ${response.status} ${errorText}`)
    }

    return await response.json()
}

async function fetchBrowserUseSessionWithOutput(sessionId: string, apiKey: string) {
    let latestSession: any = null

    for (let attempt = 0; attempt < 6; attempt++) {
        latestSession = await fetchBrowserUseSession(sessionId, apiKey)
        if (latestSession?.output) return latestSession
        await new Promise((resolve) => setTimeout(resolve, 2500))
    }

    return latestSession
}

function extractOutputResults(output: unknown) {
    if (!output) return []
    const parsed = typeof output === 'string' ? JSON.parse(output) : output as any
    const found = findResultsArray(parsed)
    return found || []
}

function findResultsArray(value: unknown): any[] | null {
    if (!value) return null
    if (Array.isArray(value)) {
        if (value.length === 0) return value
        if (value.every((item) => item && typeof item === 'object' && ('website' in item || 'url' in item))) {
            return value
        }
        for (const item of value) {
            const nested = findResultsArray(item)
            if (nested) return nested
        }
        return null
    }

    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>
        if (Array.isArray(objectValue.results)) return objectValue.results
        for (const nestedValue of Object.values(objectValue)) {
            const nested = findResultsArray(nestedValue)
            if (nested) return nested
        }
    }

    return null
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const rawBody = await req.text()
        const isValid = await verifyBrowserUseWebhook(rawBody, req)
        if (!isValid) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid Browser Use webhook signature' }),
                { status: 401, headers: corsHeaders }
            )
        }

        const webhook = JSON.parse(rawBody) as BrowserUseWebhookPayload

        if (webhook.type === 'test') {
            return new Response(
                JSON.stringify({ success: true, status: 'ok', message: 'Browser Use webhook test received' }),
                { status: 200, headers: corsHeaders }
            )
        }

        const sessionId = webhook.payload?.session_id || webhook.payload?.task_id
        const status = webhook.payload?.status

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (!sessionId) throw new Error('payload.session_id is required')

        const { data: keywordJob, error: jobError } = await supabaseClient
            .from('browser_use_keyword_jobs')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle()

        if (jobError) {
            throw new Error(`Browser Use job lookup error: ${jobError.message}`)
        }

        if (!keywordJob) {
            return new Response(JSON.stringify({ success: true, ignored: true, reason: 'No matching keyword job' }), { headers: corsHeaders })
        }

        const job = keywordJob as BrowserUseKeywordJob

        const apiKey = Deno.env.get('BROWSER_USE_API_KEY')
        if (!apiKey) throw new Error('BROWSER_USE_API_KEY is not configured')

        const session = await fetchBrowserUseSessionWithOutput(sessionId, apiKey)
        const outputResults = extractOutputResults(session)
        if (outputResults.length === 0) {
            if (status === 'error' || status === 'timed_out') {
                await supabaseClient
                    .from('browser_use_keyword_jobs')
                    .update({ status })
                    .eq('session_id', sessionId)

                if (job.search_id) {
                    const channel = supabaseClient.channel(`search-status-${job.search_id}`)
                    await channel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: `Browser Use task ${status}`, status: 'failed', count: 0 },
                    }, { httpSend: true })
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    status,
                    session_status: session?.status || null,
                    processed: false,
                    reason: 'Session output/results not ready',
                }),
                { headers: corsHeaders }
            )
        }

        const results = normalizeResults(outputResults)

        if (results.length > 0) {
            const websites = results.map((result) => result.website)
            const { data: existingRows, error: existingError } = await supabaseClient
                .from('keyword_search_results')
                .select('website')
                .eq('user_id', job.user_id)
                .eq('search_query', job.search_query)
                .in('website', websites)

            if (existingError) {
                throw new Error(`Database lookup error: ${existingError.message}`)
            }

            const existingWebsites = new Set((existingRows || []).map((row: { website: string }) => row.website))
            const rows = results
                .filter((result) => !existingWebsites.has(result.website))
                .map((result) => ({
                user_id: job.user_id,
                search_query: job.search_query,
                company_name: result.company_name,
                website: result.website,
                company_description: result.company_description,
                analyzed: false,
                analysis_id: null,
                creator_name: job.creator_name || null,
                creator_email: job.creator_email || null,
            }))

            if (rows.length > 0) {
                const { error: insertError } = await supabaseClient
                    .from('keyword_search_results')
                    .insert(rows)

                if (insertError) {
                    throw new Error(`Database error: ${insertError.message}`)
                }
            }
        }

        await supabaseClient
            .from('browser_use_keyword_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('session_id', sessionId)

        if (job.search_id) {
            const channel = supabaseClient.channel(`search-status-${job.search_id}`)
            await channel.send({
                type: 'broadcast',
                event: 'status_update',
                payload: {
                    message: 'Search complete!',
                    status: 'completed',
                    count: results.length,
                },
            }, { httpSend: true })
        }

        return new Response(
            JSON.stringify({ success: true, status, count: results.length }),
            { headers: corsHeaders }
        )
    } catch (error) {
        console.error('Browser Use keyword callback error:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: corsHeaders }
        )
    }
})
