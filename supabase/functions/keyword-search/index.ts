// Import the Deno server library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS headers for allowing frontend requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

// Type definitions
interface WorkflowInput {
    input_as_text: string
    user_id: string
    search_id?: string
    creator_name?: string
    creator_email?: string
}

interface SearchResult {
    url: string
    company_name: string
    company_description: string
}

interface BrowserUseSessionResponse {
    id: string
    status?: string
    output?: unknown
    liveUrl?: string | null
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let statusChannel: any = null

    try {
        // Parse request payload
        const body = await req.text()

        const { input_as_text, user_id, search_id, creator_name, creator_email } = JSON.parse(body) as WorkflowInput
        const effectiveSearchId = search_id || crypto.randomUUID()

        if (!input_as_text) {
            throw new Error('input_as_text is required')
        }

        if (!user_id) {
            throw new Error('user_id is required')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Realtime status broadcaster
        statusChannel = effectiveSearchId ? supabaseClient.channel(`search-status-${effectiveSearchId}`) : null

        const updateStatus = async (msg: string) => {
            console.log(`[Status Update] ${msg}`)
            if (statusChannel) {
                await statusChannel.send({
                    type: 'broadcast',
                    event: 'status_update',
                    payload: { message: msg, status: 'processing' }
                }, { httpSend: true })
            }
        }

        const browserUseApiKey = Deno.env.get('BROWSER_USE_API_KEY')
        if (browserUseApiKey) {
            console.log('Starting Browser Use keyword research workflow for:', input_as_text)
            await updateStatus('Starting Browser Use research session...')

            const browserUseSession = await startBrowserUseKeywordResearch({
                apiKey: browserUseApiKey,
                input_as_text,
                user_id,
                search_id: effectiveSearchId,
                creator_name,
                creator_email,
            })

            await createBrowserUseKeywordJob(supabaseClient, {
                session_id: browserUseSession.id,
                user_id,
                search_id: effectiveSearchId,
                search_query: input_as_text,
                creator_name,
                creator_email,
            })

            await updateStatus('Waiting for Browser Use research output...')
            const completedBrowserUseSession = await waitForBrowserUseOutput(browserUseApiKey, browserUseSession.id)
            const browserUseOutput = completedBrowserUseSession?.output || browserUseSession.output

            if (browserUseOutput) {
                await updateStatus('Saving Browser Use research results...')
                const cleanResults = normalizeBrowserUseOutput(browserUseOutput)
                const resultsToInsert = await saveKeywordResults(supabaseClient, {
                    user_id,
                    search_query: input_as_text,
                    results: cleanResults,
                    creator_name,
                    creator_email,
                })

                if (statusChannel) {
                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: 'Search complete!', status: 'completed', count: resultsToInsert.length }
                    }, { httpSend: true })
                }

                return new Response(
                    JSON.stringify({
                        success: true,
                        mode: 'browser-use',
                        session_id: browserUseSession.id,
                        live_url: browserUseSession.liveUrl,
                        results: resultsToInsert,
                        count: resultsToInsert.length,
                        message: 'Browser Use keyword search completed successfully'
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            await updateStatus('Browser Use research is running...')
            return new Response(
                    JSON.stringify({
                        success: true,
                        mode: 'browser-use',
                        search_id: effectiveSearchId,
                        session_id: browserUseSession.id,
                        live_url: browserUseSession.liveUrl,
                        message: 'Browser Use keyword research started'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get API keys from environment
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY') || Deno.env.get('VITE_FIRECRAWL_API_KEY')

        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }
        if (!firecrawlApiKey) {
            console.error('FIRECRAWL_API_KEY missing')
            throw new Error('FIRECRAWL_API_KEY not configured - required for real web search')
        }

        console.log('Starting real keyword search workflow for:', input_as_text)
        await updateStatus('Deploying Discovery Crawlers...')

        // 1. Perform Real Web Search via Firecrawl
        await updateStatus('Searching Global & German indices via Firecrawl...')
        const rawSearchResults = await performFirecrawlSearch(input_as_text, firecrawlApiKey)
        console.log(`Firecrawl returned ${rawSearchResults.length} raw results`)

        // 2. Use OpenAI to Format and Filter Results
        await updateStatus('Filtering for high-quality leads with AI...')
        const cleanResults = await formatSearchResults(rawSearchResults, openaiApiKey)
        console.log(`OpenAI formatted ${cleanResults.length} clean results`)

        await updateStatus('Finalizing discovery batch...')

        const resultsToInsert = await saveKeywordResults(supabaseClient, {
            user_id,
            search_query: input_as_text,
            results: cleanResults,
            creator_name,
            creator_email,
        })

        // Send completion signal
        if (statusChannel) {
            console.log('Sending completion broadcast for search:', search_id)
            await statusChannel.send({
                type: 'broadcast',
                event: 'status_update',
                payload: { message: 'Search complete!', status: 'completed', count: resultsToInsert.length }
            }, { httpSend: true })
            console.log('Completion broadcast sent')
        }

        return new Response(
            JSON.stringify({
                success: true,
                results: resultsToInsert,
                count: resultsToInsert.length,
                message: 'Keyword search completed successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Keyword search error:', error)
        if (statusChannel) {
            await statusChannel.send({
                type: 'broadcast',
                event: 'status_update',
                payload: { message: (error as Error).message, status: 'failed' }
            }, { httpSend: true }).catch((broadcastError: unknown) => {
                console.error('Failed to broadcast keyword search failure:', broadcastError)
            })
        }
        return new Response(
            JSON.stringify({
                success: false,
                error: (error as Error).message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})

const keywordOutputSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        status: { type: 'string', enum: ['success', 'partial', 'failure'] },
        error: { type: ['string', 'null'] },
        results: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    company_name: { type: 'string' },
                    website: { type: 'string' },
                    company_description: { type: 'string' },
                    category: { type: 'string' },
                    country: { type: 'string' },
                    shipping_evidence: { type: 'string' },
                    revenue_evidence: { type: 'string' },
                    revenue_estimate: { type: 'string' },
                    evidence_urls: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                required: [
                    'company_name',
                    'website',
                    'company_description',
                    'category',
                    'country',
                    'shipping_evidence',
                    'revenue_evidence',
                    'revenue_estimate',
                    'evidence_urls',
                ],
            },
        },
    },
    required: ['status', 'results'],
}

function buildBrowserUseResearchTask(userRequest: string): string {
    return `Run this keyword research task and return structured JSON only.

User request:
${userRequest}

Default target if the user does not specify a count: find exactly 20 companies.
If the user specifies a count, honor that count.

Required filters for every result:
1. The company is Dutch or Netherlands-based.
2. The company operates a webshop or direct ecommerce storefront.
3. The webshop offers shipping outside the Netherlands.
4. There is a reasonable indication of at least EUR 500k annual revenue.
5. The returned URL is the company's own website or webshop, not a directory, article, social profile, marketplace profile, aggregator, or marketplace listing.

Target categories:
- food
- health
- wellness
- fitness
- supplements
- beauty
- performance brands
- adjacent consumer product categories if they clearly match the commercial intent

Verification instructions:
- Inspect official websites/webshops.
- Verify international shipping through shipping pages, delivery pages, checkout country selectors, FAQ pages, terms pages, or visible country/language/currency options.
- Estimate EUR 500k+ revenue from public signals such as employees, retail footprint, international distribution, wholesale/B2B presence, marketplace footprint, press coverage, funding, traffic/visibility, brand age, company registry snippets, or store count.
- Deduplicate by root domain.
- Reject directories, marketplaces, blogs, listicles, LinkedIn pages, Instagram pages, review sites, and news-only pages.

Return data matching the provided output schema. Use status "partial" if fewer than the requested number can be verified. Use status "failure" with results [] only if the task cannot be completed.`
}

async function startBrowserUseKeywordResearch({
    apiKey,
    input_as_text,
    user_id,
    search_id,
    creator_name,
    creator_email,
}: WorkflowInput & { apiKey: string }): Promise<BrowserUseSessionResponse> {
    const response = await fetch('https://api.browser-use.com/api/v3/sessions', {
        method: 'POST',
        headers: {
            'X-Browser-Use-API-Key': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            task: buildBrowserUseResearchTask(input_as_text),
            model: Deno.env.get('BROWSER_USE_MODEL') || 'bu-mini',
            keepAlive: false,
            maxCostUsd: Deno.env.get('BROWSER_USE_MAX_COST_USD') || '5',
            proxyCountryCode: (Deno.env.get('BROWSER_USE_PROXY_COUNTRY') || 'nl').toLowerCase(),
            outputSchema: keywordOutputSchema,
            metadata: {
                workflow: 'keyword-search',
                search_id: search_id || '',
                user_id,
                search_query: input_as_text.slice(0, 500),
                creator_name: creator_name || '',
                creator_email: creator_email || '',
            },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Browser Use API error:', errorText)
        throw new Error(`Browser Use API error: ${response.status} ${errorText}`)
    }

    return await response.json() as BrowserUseSessionResponse
}

async function fetchBrowserUseSession(apiKey: string, sessionId: string): Promise<BrowserUseSessionResponse> {
    const response = await fetch(`https://api.browser-use.com/api/v3/sessions/${sessionId}`, {
        headers: {
            'X-Browser-Use-API-Key': apiKey,
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.warn(`Browser Use session fetch failed: ${response.status} ${errorText}`)
        return { id: sessionId }
    }

    return await response.json() as BrowserUseSessionResponse
}

async function waitForBrowserUseOutput(apiKey: string, sessionId: string): Promise<BrowserUseSessionResponse | null> {
    const maxAttempts = Number(Deno.env.get('BROWSER_USE_POLL_ATTEMPTS') || '36')
    const intervalMs = Number(Deno.env.get('BROWSER_USE_POLL_INTERVAL_MS') || '5000')

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const session = await fetchBrowserUseSession(apiKey, sessionId)
        if (session.output) return session

        if (session.status === 'error' || session.status === 'timed_out') {
            console.warn(`Browser Use session ended without output: ${session.status}`)
            return session
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    return null
}

async function createBrowserUseKeywordJob(
    supabaseClient: any,
    {
        session_id,
        user_id,
        search_id,
        search_query,
        creator_name,
        creator_email,
    }: {
        session_id: string
        user_id: string
        search_id: string
        search_query: string
        creator_name?: string
        creator_email?: string
    }
) {
    const { error } = await supabaseClient
        .from('browser_use_keyword_jobs')
        .upsert({
            session_id,
            user_id,
            search_id,
            search_query,
            creator_name: creator_name || null,
            creator_email: creator_email || null,
            status: 'created',
        }, { onConflict: 'session_id' })

    if (error) {
        throw new Error(`Browser Use job tracking error: ${error.message}`)
    }
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

function buildDescription(result: any): string {
    const base = result.company_description || result.companyDescription || ''
    const details = [
        result.category ? `Category: ${result.category}.` : '',
        result.shipping_evidence || result.shippingEvidence ? `Shipping evidence: ${result.shipping_evidence || result.shippingEvidence}.` : '',
        result.revenue_evidence || result.revenueEvidence ? `Revenue signal: ${result.revenue_evidence || result.revenueEvidence}.` : '',
        result.revenue_estimate || result.revenueEstimate ? `Revenue estimate: ${result.revenue_estimate || result.revenueEstimate}.` : '',
    ].filter(Boolean)

    return [base, ...details].filter(Boolean).join(' ').slice(0, 2000)
}

function normalizeBrowserUseOutput(output: unknown): SearchResult[] {
    const parsed = typeof output === 'string' ? JSON.parse(output) : output as any
    const rawResults = Array.isArray(parsed?.results) ? parsed.results : Array.isArray(parsed) ? parsed : []
    const seenDomains = new Set<string>()

    return rawResults.flatMap((result: any) => {
        const url = normalizeUrl(result.website || result.url || '')
        const companyName = result.company_name || result.companyName
        const domain = rootDomain(url)

        if (!url || !companyName || !domain || seenDomains.has(domain)) {
            return []
        }

        seenDomains.add(domain)

        return [{
            url,
            company_name: companyName.trim(),
            company_description: buildDescription(result),
        }]
    })
}

async function saveKeywordResults(
    supabaseClient: any,
    {
        user_id,
        search_query,
        results,
        creator_name,
        creator_email,
    }: {
        user_id: string
        search_query: string
        results: SearchResult[]
        creator_name?: string
        creator_email?: string
    }
) {
    const resultsToInsert = results.map((result: SearchResult) => ({
        user_id,
        search_query,
        company_name: result.company_name,
        website: result.url,
        company_description: result.company_description,
        analyzed: false,
        analysis_id: null,
        creator_name: creator_name || null,
        creator_email: creator_email || null
    }))

    if (resultsToInsert.length === 0) {
        return resultsToInsert
    }

    const { data, error: insertError } = await supabaseClient
        .from('keyword_search_results')
        .insert(resultsToInsert)
        .select()

    if (insertError) {
        console.error('Error saving to database:', insertError)
        throw new Error(`Database error: ${insertError.message}`)
    }

    console.log(`Saved ${data?.length} results to database`)
    return resultsToInsert
}

/**
 * Perform real web search using Firecrawl /v1/search API
 */
async function performFirecrawlSearch(query: string, apiKey: string): Promise<any[]> {
    console.log(`Calling Firecrawl Search API for: "${query}"`)

    // Construct search query - optimizing for company discovery
    // Force company homepages and exclude noise (lists, blogs, directories)
    const smartQuery = `${query} "official website" -inurl:blog -site:clutch.co -site:yelp.com -site:linkedin.com -"top 10" -list`

    try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: smartQuery,
                limit: 15, // Increase limit to throw away noise
                scrapeOptions: {
                    formats: ['markdown']
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Firecrawl API Error:', errorText)
            throw new Error(`Firecrawl Search API error: ${errorText}`)
        }

        const data = await response.json()

        // Firecrawl search response structure: { success: true, data: [ { url, title, description, ... } ] }
        if (!data.success || !data.data) {
            console.warn('Firecrawl response success=false or missing data', data)
            return []
        }

        return data.data
    } catch (err) {
        console.error('Firecrawl Search Exception:', err)
        throw err
    }
}

/**
 * Use OpenAI to parse and format raw search results into clean company data
 */
async function formatSearchResults(
    rawResults: any[],
    apiKey: string
): Promise<SearchResult[]> {
    if (!rawResults || rawResults.length === 0) return []

    console.log('Calling OpenAI to format search results...')

    const systemPrompt = `You are a Data Extraction Assistant.
Your goal is to extract a list of DISTINCT COMPANIES from the provided search results.

Input: JSON list of search results (url, title, description).
Output: JSON list of valid companies.

Rules:
1. Ignore directories, aggregators (like Yelp, Clutch, LinkedIn lists), and articles.
2. Focus on REAL COMPANY websites (e.g. agency websites, saas product pages).
3. Use the Snippet/Description to generate a brief 1-sentence Company Description.
4. Normalize the Company Name.

Output Format:
{
  "results": [
    {
        "url": "https://company.com", 
        "company_name": "Company Name", 
        "company_description": "Brief description..."
    }
  ]
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Here are the raw search results:\n${JSON.stringify(rawResults, null, 2)}`
                }
            ],
            max_completion_tokens: 4000,
            response_format: { type: 'json_object' }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        console.error('OpenAI Formatting Error:', error)
        // Fallback: Try to map raw results directly if AI fails
        return rawResults.map(r => ({
            url: r.url,
            company_name: r.title || 'Unknown',
            company_description: r.description || ''
        }))
    }

    const data = await response.json()
    try {
        const parsed = JSON.parse(data.choices[0]?.message?.content || '{}')
        return parsed.results || []
    } catch (e) {
        console.error('Error parsing OpenAI response:', e)
        return []
    }
}
