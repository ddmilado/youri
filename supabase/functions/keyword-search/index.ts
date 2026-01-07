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

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse request payload
        const body = await req.text()
        console.log('Request body:', body)

        const { input_as_text, user_id, search_id, creator_name, creator_email } = JSON.parse(body) as WorkflowInput

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
        const statusChannel = search_id ? supabaseClient.channel(`search-status-${search_id}`) : null

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

        // Save results to Supabase
        const resultsToInsert = cleanResults.map((result: SearchResult) => ({
            user_id,
            search_query: input_as_text,
            company_name: result.company_name,
            website: result.url,
            company_description: result.company_description,
            analyzed: false,
            analysis_id: null,
            creator_name: creator_name || null,
            creator_email: creator_email || null
        }))

        if (resultsToInsert.length > 0) {
            const { data, error: insertError } = await supabaseClient
                .from('keyword_search_results')
                .insert(resultsToInsert)
                .select()

            if (insertError) {
                console.error('Error saving to database:', insertError)
                throw new Error(`Database error: ${insertError.message}`)
            }
            console.log(`Saved ${data?.length} results to database`)
        }

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

/**
 * Perform real web search using Firecrawl /v1/search API
 */
async function performFirecrawlSearch(query: string, apiKey: string): Promise<any[]> {
    console.log(`Calling Firecrawl Search API for: "${query}"`)

    // Construct search query - optimizing for company discovery
    // If the query is just a niche, add "companies" or "startups" to it? 
    // Actually, trust the user's query but ensure it's broad enough.

    try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                limit: 10,
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