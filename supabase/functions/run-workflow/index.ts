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

        // Get API keys from environment
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }

        const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
        if (!firecrawlApiKey) {
            throw new Error('FIRECRAWL_API_KEY not configured')
        }

        console.log('Starting OpenAI workflow for input:', input_as_text)

        // Step 1: Crawl the entire website with Firecrawl for comprehensive content
        let scrapedContent = ''
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)

        if (urlMatch) {
            const url = urlMatch[1]
            console.log('Crawling entire website with Firecrawl:', url)

            try {
                // Start the crawl job
                // Using v1 API which is stable
                const crawlResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${firecrawlApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: url,
                        limit: 10,
                        scrapeOptions: {
                            formats: ['markdown'],
                            onlyMainContent: true
                        }
                    })
                })

                if (!crawlResponse.ok) {
                    console.error('Firecrawl crawl start failed:', await crawlResponse.text())
                } else {
                    const crawlData = await crawlResponse.json()
                    const jobId = crawlData.id || crawlData.jobId
                    console.log('Crawl job started:', jobId)

                    if (jobId) {
                        // Poll for crawl completion
                        let attempts = 0
                        const maxAttempts = 45 // Wait up to 90 seconds (45 * 2s)

                        while (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

                            const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${jobId}`, {
                                headers: {
                                    'Authorization': `Bearer ${firecrawlApiKey}`
                                }
                            })

                            if (statusResponse.ok) {
                                const statusData = await statusResponse.json()
                                console.log('Crawl status:', statusData.status)

                                if (statusData.status === 'completed') {
                                    console.log('Crawl completed! Pages found:', statusData.data?.length || 0)

                                    // Combine content from all crawled pages
                                    const pages = statusData.data || []
                                    scrapedContent = pages.map((page: any) => {
                                        const pageUrl = page.metadata?.url || page.url || ''
                                        const content = page.markdown || page.content || ''
                                        return `\n\n=== PAGE: ${pageUrl} ===\n${content}`
                                    }).join('\n\n')
                                    break
                                } else if (statusData.status === 'failed') {
                                    console.error('Crawl failed:', statusData.error)
                                    break
                                }
                                // Otherwise status is 'active' or 'scraping', continue polling
                            }
                            attempts++
                        }
                    }
                }
            } catch (error) {
                console.error('Error during crawling:', error)
            }
        }

        // Execute the workflow using OpenAI API with real crawled content
        const workflowResult = await executeAgentWorkflow(input_as_text, scrapedContent, openaiApiKey)

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
                linkedin: workflowResult.linkedIn,
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
 * Replicates the sequential agent structure with accumulated conversation history
 */
async function executeAgentWorkflow(
    input: string,
    scrapedContent: string,
    apiKey: string
): Promise<LeadResult> {

    // Initialize conversation history with user input and scraped content
    // This allows all agents to see the context
    // We truncate content to ~40k chars to be safe for 128k context window while allowing space for history
    const messages: Array<{ role: string; content: string }> = [
        {
            role: 'user',
            content: `User Input: ${input}\n\n[CONTEXT: Scraped Website Content Start]\n${scrapedContent.substring(0, 40000)}\n[CONTEXT: Scraped Website Content End]`
        }
    ]

    // Agent 1: Google Search Scraper
    console.log('Agent 1: Google Search / Search Agent')
    const agent1Instruction = `You are a Search Agent.

Your task is to:
1. Accept user-provided urls, or keywords or both and Google search operators.
2. If user input is ONLY a url just skip all process and reproduce the url, otherwise keyword, Perform Google searches of such companies using the provided context.
3. Extract organic result URLs only of the relevant companies.
4. Return a clean list of discovered simple cleaned URLs with:
   - URL
   - Page title (if available)

Do NOT analyze content yet.
Do NOT validate language yet.
Do NOT score leads yet.`

    const res1 = await callOpenAI(apiKey, agent1Instruction, messages)
    messages.push({ role: 'assistant', content: res1 })


    // Agent 2: URL Normalization Agent
    console.log('Agent 2: URL Normalization Agent')
    const agent2Instruction = `You are a URL Normalization Agent.

Your responsibilities:
1. Accept url inputs from the previous step, then Normalize URLs (remove UTM parameters, fragments, session IDs).
2. Deduplicate results by root domain.
3. Ensure URLs are reachable.
4. Output only unique, clean URLs.

Do NOT analyze language or content.`

    const res2 = await callOpenAI(apiKey, agent2Instruction, messages)
    messages.push({ role: 'assistant', content: res2 })


    // Agent 3: Country Confirmation Agent
    console.log('Agent 3: Country Confirmation Agent')
    const agent3Instruction = `You are an ai agent, your job is to do the following 
verify if a German version of this website exists based on the provided content / context.

You must detect:
- URL Patterns: Presence of /de/, /de-de/, or de. subdomains
- Visual Elements: Presence of a Language Switcher (Flags, Dropdowns) or hreflang="de" tags
- Content: Actual German text in the scraped content

Outcome: Only websites that pass this "German Signal Check" are saved as leads.
If the website or url has german content or the company operates in germany, proceed to the next node.`

    const res3 = await callOpenAI(apiKey, agent3Instruction, messages)
    messages.push({ role: 'assistant', content: res3 })


    // Agent 4: Localization Quality Analysis Agent
    console.log('Agent 4: Localization Quality Analysis Agent')
    const agent4Instruction = `You are a Localization Quality Analysis Agent.

Your task:
1. Analyze the German-language content of the provided website (from context).
2. Detect signs of poor localization, including:
   - Grammar or syntax errors
   - Mixed German and English text
   - Awkward phrasing typical of machine translation
   - Inconsistent terminology
3. Provide:
   - A quality score from 0–100
   - Specific error examples (quotes from the text)
   - A brief explanation of issues found

Do NOT fix the errors.
Do NOT rewrite content.
Focus only on evaluation.`

    const res4 = await callOpenAI(apiKey, agent4Instruction, messages)
    messages.push({ role: 'assistant', content: res4 })


    // Agent 5: Lead Scoring & Structuring Agent
    console.log('Agent 5: Lead Scoring & Structuring Agent')
    const agent5Instruction = `You are a Lead Structuring Agent.

Your responsibilities:
1. Combine validation and localization analysis data.
2. Assign a final lead quality label:
   - High Opportunity (0–50)
   - Medium Opportunity (51–75)
   - Low Opportunity (76-100)
3. Extract extensive company details and contacts from the website content.
4. Output clean, structured data.`

    const res5 = await callOpenAI(apiKey, agent5Instruction, messages)
    messages.push({ role: 'assistant', content: res5 })


    // Agent 6: Export Agent (CSV / Excel) schema enforcement
    console.log('Agent 6: Export Agent')
    const agent6Instruction = `You are an Export Agent.

Your task:
1. Accept structured lead data from previous steps.
2. Output valid JSON matching this schema exactly:
{
  "company": "string",
  "website": "string",
  "industry": "string",
  "hq_location": "string",
  "founded": number or null,
  "employees": "string",
  "markets": "string",
  "revenue_2023_eur": "string",
  "linkedIn": "string",
  "twitter": "string",
  "contacts": [ { "name": "string", "title": "string", "linkedin": "string", "email": "string" } ],
  "lead_quality_label": "string",
  "lead_quality_score": number,
  "localization_evidence": {
    "tld": "string",
    "language_options": "string",
    "german_content_on_main_domain": boolean,
    "localization_quality_on_english_page": "string (evidence)"
  },
  "notes": "string"
}

IMPORTANT: Return ONLY valid JSON. No markdown formatting.`

    // We add a specific user message to trigger the final export format
    messages.push({ role: 'user', content: "Generate the final JSON output now." })

    const res6 = await callOpenAI(apiKey, agent6Instruction, messages)

    // Parse and Validate
    try {
        let cleanJson = res6.trim()
        // Remove markdown code blocks if present
        cleanJson = cleanJson.replace(/^```json\n?/, '').replace(/\n?```$/, '')

        const parsed = JSON.parse(cleanJson)

        // Ensure all required fields exist (fallback to empty strings if missing)
        return {
            company: parsed.company || '',
            website: parsed.website || '',
            industry: parsed.industry || '',
            hq_location: parsed.hq_location || '',
            founded: typeof parsed.founded === 'number' ? parsed.founded : null,
            employees: parsed.employees || '',
            markets: parsed.markets || '',
            revenue_2023_eur: parsed.revenue_2023_eur || '',
            linkedIn: parsed.linkedIn || '',
            twitter: parsed.twitter || '',
            contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
            lead_quality_label: parsed.lead_quality_label || '',
            lead_quality_score: typeof parsed.lead_quality_score === 'number' ? parsed.lead_quality_score : null,
            localization_evidence: {
                tld: parsed.localization_evidence?.tld || '',
                language_options: parsed.localization_evidence?.language_options || '',
                german_content_on_main_domain: !!parsed.localization_evidence?.german_content_on_main_domain,
                localization_quality_on_english_page: parsed.localization_evidence?.localization_quality_on_english_page || ''
            },
            notes: parsed.notes || ''
        }

    } catch (e) {
        console.error('JSON Parse Error:', e)
        console.log('Raw output:', res6)
        throw new Error('Failed to parse final agent output')
    }
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini'
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
            model: model,
            messages,
            temperature: 0.7,
            max_tokens: 4000
        })
    })

    if (!response.ok) {
        const error = await response.text()
        console.error(`OpenAI Error (${model}):`, error)
        throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
}
