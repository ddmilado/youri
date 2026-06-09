import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

interface HermesResult {
    company_name?: string
    companyName?: string
    website?: string
    url?: string
    company_description?: string
    companyDescription?: string
    category?: string
    country?: string
    shipping_evidence?: string
    shippingEvidence?: string
    revenue_evidence?: string
    revenueEvidence?: string
    revenue_estimate?: string
    revenueEstimate?: string
    evidence_urls?: string[]
    evidenceUrls?: string[]
}

interface HermesCallbackPayload {
    search_id?: string
    user_id: string
    search_query?: string
    original_query?: string
    status?: 'success' | 'partial' | 'failure'
    error?: string
    results?: HermesResult[]
    creator_name?: string
    creator_email?: string
}

function getBearerToken(req: Request): string | null {
    const header = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!header) return null
    const match = header.match(/^Bearer\s+(.+)$/i)
    return match ? match[1] : header
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

function buildDescription(result: HermesResult): string {
    const base = result.company_description || result.companyDescription || ''
    const details = [
        result.category ? `Category: ${result.category}.` : '',
        result.shipping_evidence || result.shippingEvidence ? `Shipping evidence: ${result.shipping_evidence || result.shippingEvidence}.` : '',
        result.revenue_evidence || result.revenueEvidence ? `Revenue signal: ${result.revenue_evidence || result.revenueEvidence}.` : '',
        result.revenue_estimate || result.revenueEstimate ? `Revenue estimate: ${result.revenue_estimate || result.revenueEstimate}.` : '',
    ].filter(Boolean)

    return [base, ...details].filter(Boolean).join(' ').slice(0, 2000)
}

function normalizeResults(results: HermesResult[]) {
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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const expectedToken = Deno.env.get('HERMES_CALLBACK_TOKEN')
        if (!expectedToken) {
            throw new Error('HERMES_CALLBACK_TOKEN is not configured')
        }

        const actualToken = getBearerToken(req)
        if (actualToken !== expectedToken) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized Hermes callback' }),
                { status: 401, headers: corsHeaders }
            )
        }

        const payload = await req.json() as HermesCallbackPayload
        if (!payload.user_id) throw new Error('user_id is required')

        const status = payload.status || 'success'
        const results = normalizeResults(payload.results || [])
        const searchQuery = payload.search_query || payload.original_query || 'Hermes keyword search'

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (status !== 'failure' && results.length > 0) {
            const rows = results.map((result) => ({
                user_id: payload.user_id,
                search_query: searchQuery,
                company_name: result.company_name,
                website: result.website,
                company_description: result.company_description,
                analyzed: false,
                analysis_id: null,
                creator_name: payload.creator_name || null,
                creator_email: payload.creator_email || null,
            }))

            const { error: insertError } = await supabaseClient
                .from('keyword_search_results')
                .insert(rows)

            if (insertError) {
                console.error('Hermes callback insert error:', insertError)
                throw new Error(`Database error: ${insertError.message}`)
            }
        }

        if (payload.search_id) {
            const channel = supabaseClient.channel(`search-status-${payload.search_id}`)
            const broadcastStatus = status === 'failure' ? 'failed' : 'completed'
            await channel.send({
                type: 'broadcast',
                event: 'status_update',
                payload: {
                    message: status === 'failure' ? payload.error || 'Hermes research failed' : 'Search complete!',
                    status: broadcastStatus,
                    count: results.length,
                },
            }, { httpSend: true })
        }

        return new Response(
            JSON.stringify({
                success: status !== 'failure',
                status,
                count: results.length,
                error: payload.error || null,
            }),
            { headers: corsHeaders }
        )
    } catch (error) {
        console.error('Hermes keyword callback error:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: corsHeaders }
        )
    }
})
