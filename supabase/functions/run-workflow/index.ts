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
}

interface LeadResult {
    company: string
    website: string
    industry: string
    hq_location: string
    founded: number | null
    employees: string
    markets: string
    revenue_2023_eur: string
    linkedIn: string
    twitter: string
    contacts: Array<{
        name: string
        title: string
        linkedin: string
        email: string
    }>
    lead_quality_label: string
    lead_quality_score: number | null
    localization_evidence: {
        tld: string
        language_options: string
        german_content_on_main_domain: boolean
        localization_quality_on_english_page: string
    }
    notes: string
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

        const { input_as_text, user_id } = JSON.parse(body) as WorkflowInput

        if (!input_as_text) {
            throw new Error('input_as_text is required')
        }

        if (!user_id) {
            throw new Error('user_id is required')
        }

        // Get OpenAI API key from environment
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }

        console.log('Starting OpenAI workflow for input:', input_as_text)

        // Execute the workflow using OpenAI API
        // Note: We're using the OpenAI API directly since the @openai/agents SDK
        // may not be compatible with Deno runtime. We'll simulate the agent workflow
        // by making sequential API calls to OpenAI's Chat Completions API

        const workflowResult = await executeAgentWorkflow(input_as_text, openaiApiKey)

        // Save result to Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data, error: insertError } = await supabaseClient
            .from('ai_lead_results')
            .insert({
                user_id,
                input_query: input_as_text,
                company: workflowResult.company,
                website: workflowResult.website,
                industry: workflowResult.industry,
                hq_location: workflowResult.hq_location,
                founded: workflowResult.founded,
                employees: workflowResult.employees,
                markets: workflowResult.markets,
                revenue_2023_eur: workflowResult.revenue_2023_eur,
                linkedin: workflowResult.linkedIn, // Map camelCase to lowercase
                twitter: workflowResult.twitter,
                contacts: workflowResult.contacts,
                lead_quality_label: workflowResult.lead_quality_label,
                lead_quality_score: workflowResult.lead_quality_score,
                localization_evidence: workflowResult.localization_evidence,
                notes: workflowResult.notes
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error saving to database:', insertError)
            throw new Error(`Database error: ${insertError.message}`)
        }

        console.log('Workflow completed successfully, saved with ID:', data.id)

        return new Response(
            JSON.stringify({
                success: true,
                result: data,
                message: 'Workflow completed successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Workflow error:', error)
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
 * Execute the multi-agent workflow using OpenAI API
 */
async function executeAgentWorkflow(
    input: string,
    apiKey: string
): Promise<LeadResult> {

    // Agent 1: Google Search Scraper
    console.log('Agent 1: Google Search Scraper')
    const searchResults = await callOpenAI(
        apiKey,
        `You are a Search Agent. Accept user-provided urls, or keywords or both and Google search operators.
If user input is ONLY a url just skip all process and reproduce the url, otherwise keyword, perform analysis of companies, using those inputs making sure they are relevant and operational in the last 6 months.
Extract relevant company URLs only (ignore ads, maps, featured snippets).
Return a clean list of discovered simple cleaned URLs.

User input: ${input}

Respond with a list of URLs (one per line) or the original URL if it's just a URL.`,
        []
    )

    // Agent 2: URL Normalization
    console.log('Agent 2: URL Normalization')
    const normalizedUrls = await callOpenAI(
        apiKey,
        `You are a URL Normalization Agent. Normalize URLs (remove UTM parameters, fragments, session IDs).
Deduplicate results by root domain. Output only unique, clean URLs.`,
        [
            { role: 'user', content: input },
            { role: 'assistant', content: searchResults },
        ]
    )

    // Agent 3: Country Confirmation (German market focus)
    console.log('Agent 3: Country Confirmation')
    const countryConfirmed = await callOpenAI(
        apiKey,
        `You are a Country Confirmation Agent. Verify if a German version of this website exists.
Detect: URL Patterns (/de/, /de-de/, de. subdomains), Language Switcher, hreflang="de" tags.
If the website has German content or the company operates in Germany, respond with "CONFIRMED" and explain what you found.
Otherwise respond with "NOT CONFIRMED" and explain why.`,
        [
            { role: 'user', content: input },
            { role: 'assistant', content: searchResults },
            { role: 'assistant', content: normalizedUrls },
        ]
    )

    // Agent 4: Localization Quality Analysis
    console.log('Agent 4: Localization Quality Analysis')
    const localizationAnalysis = await callOpenAI(
        apiKey,
        `You are a Localization Quality Analysis Agent. Analyze the German-language content.
Detect signs of poor localization: grammar errors, mixed German/English, awkward phrasing, inconsistent terminology.
Provide:
- Quality score from 0-100 (0=poor, 100=excellent)
- Specific error examples
- Brief explanation

Respond in JSON format: {"quality_score": number, "examples": ["..."], "explanation": "..."}`,
        [
            { role: 'user', content: input },
            { role: 'assistant', content: searchResults },
            { role: 'assistant', content: normalizedUrls },
            { role: 'assistant', content: countryConfirmed },
        ]
    )

    // Agent 5: Lead Scoring & Structuring
    console.log('Agent 5: Lead Scoring & Structuring')
    const leadStructure = await callOpenAI(
        apiKey,
        `You are a Lead Structuring Agent. Combine validation and localization analysis data.
Assign a final lead quality label:
- High Opportunity (0-50 quality score)
- Medium Opportunity (51-75)
- Low Opportunity (76-100)

Extract company details from the input and context. Respond in JSON with this EXACT structure:
{
  "company": "Company Name",
  "website": "https://...",
  "industry": "Industry",
  "hq_location": "Location",
  "founded": 2000,
  "employees": "50-100",
  "markets": "Germany, Europe",
  "revenue_2023_eur": "5M-10M",
  "linkedIn": "https://...",
  "twitter": "https://...",
  "notes": "Additional notes"
}`,
        [
            { role: 'user', content: input },
            { role: 'assistant', content: searchResults },
            { role: 'assistant', content: normalizedUrls },
            { role: 'assistant', content: countryConfirmed },
            { role: 'assistant', content: localizationAnalysis },
        ]
    )

    // Agent 6: Export Agent - Structure the final output
    console.log('Agent 6: Export Agent - Finalizing')

    // Parse the responses to create the final structured output
    let parsedLocalization: any
    try {
        parsedLocalization = JSON.parse(localizationAnalysis)
    } catch {
        parsedLocalization = { quality_score: 50, examples: [], explanation: localizationAnalysis }
    }

    let parsedLeadData: any
    try {
        parsedLeadData = JSON.parse(leadStructure)
    } catch {
        // Fallback to extracting from input
        parsedLeadData = {
            company: extractCompanyFromInput(input),
            website: extractUrlFromInput(input) || '',
            industry: '',
            hq_location: '',
            founded: null,
            employees: '',
            markets: '',
            revenue_2023_eur: '',
            linkedIn: '',
            twitter: '',
            notes: leadStructure
        }
    }

    // Helper to safely extract fields with multiple possible names
    const safeGet = (obj: any, ...keys: string[]) => {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                return obj[key]
            }
        }
        return keys.length > 0 ? (obj?.[keys[0]] || '') : ''
    }

    // Determine lead quality label based on localization score
    const qualityScore = parsedLocalization.quality_score || parsedLocalization.qualityScore || 50
    let qualityLabel = 'Medium Opportunity'
    if (qualityScore <= 50) {
        qualityLabel = 'High Opportunity'
    } else if (qualityScore <= 75) {
        qualityLabel = 'Medium Opportunity'
    } else {
        qualityLabel = 'Low Opportunity'
    }

    // Construct the final result with flexible field extraction
    const result: LeadResult = {
        company: safeGet(parsedLeadData, 'company', 'companyName', 'name') || extractCompanyFromInput(input),
        website: safeGet(parsedLeadData, 'website', 'url', 'site') || extractUrlFromInput(input) || '',
        industry: safeGet(parsedLeadData, 'industry', 'sector', 'vertical'),
        hq_location: safeGet(parsedLeadData, 'hq_location', 'hqLocation', 'location', 'headquarters'),
        founded: parsedLeadData.founded || parsedLeadData.foundedYear || parsedLeadData.year || null,
        employees: safeGet(parsedLeadData, 'employees', 'employeeCount', 'team_size'),
        markets: safeGet(parsedLeadData, 'markets', 'regions', 'countries') || 'Germany',
        revenue_2023_eur: safeGet(parsedLeadData, 'revenue_2023_eur', 'revenue', 'revenue2023'),
        linkedIn: safeGet(parsedLeadData, 'linkedIn', 'linkedin', 'LinkedIn', 'linkedInUrl'),
        twitter: safeGet(parsedLeadData, 'twitter', 'Twitter', 'twitterUrl'),
        contacts: Array.isArray(parsedLeadData.contacts) ? parsedLeadData.contacts : [],
        lead_quality_label: qualityLabel,
        lead_quality_score: 100 - qualityScore, // Invert so higher is better
        localization_evidence: {
            tld: extractTLD(safeGet(parsedLeadData, 'website', 'url') || input),
            language_options: countryConfirmed.includes('CONFIRMED') ? 'German available' : 'Not available',
            german_content_on_main_domain: countryConfirmed.includes('CONFIRMED'),
            localization_quality_on_english_page: parsedLocalization.explanation || parsedLocalization.details || ''
        },
        notes: safeGet(parsedLeadData, 'notes', 'additionalInfo', 'description') || `Analysis based on: ${input}. ${parsedLocalization.explanation || ''}`
    }

    return result
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages,
            temperature: 1,
            max_tokens: 2048
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
}

/**
 * Helper: Extract company name from input
 */
function extractCompanyFromInput(input: string): string {
    // Try to extract from URL or use input as-is
    const urlMatch = input.match(/(?:https?:\/\/)?(?:www\.)?([^\/\.]+)/)
    if (urlMatch) {
        return urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1)
    }
    return input.split(' ')[0]
}

/**
 * Helper: Extract URL from input
 */
function extractUrlFromInput(input: string): string | null {
    const urlMatch = input.match(/(https?:\/\/[^\s]+)/i)
    return urlMatch ? urlMatch[1] : null
}

/**
 * Helper: Extract TLD from URL
 */
function extractTLD(url: string): string {
    try {
        const hostname = new URL(url.startsWith('http') ? url : 'https://' + url).hostname
        const parts = hostname.split('.')
        return parts[parts.length - 1]
    } catch {
        return ''
    }
}
