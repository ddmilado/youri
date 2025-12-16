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

        console.log('Starting keyword search workflow for:', input_as_text)

        // Call OpenAI to perform search
        const searchResults = await performKeywordSearch(input_as_text, openaiApiKey)

        // Save results to Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const resultsToInsert = searchResults.map((result: SearchResult) => ({
            user_id,
            search_query: input_as_text,
            company_name: result.company_name,
            website: result.url,
            company_description: result.company_description,
            analyzed: false,
            analysis_id: null
        }))

        const { data, error: insertError } = await supabaseClient
            .from('keyword_search_results')
            .insert(resultsToInsert)
            .select()

        if (insertError) {
            console.error('Error saving to database:', insertError)
            throw new Error(`Database error: ${insertError.message}`)
        }

        console.log(`Keyword search completed: ${searchResults.length} results saved`)

        return new Response(
            JSON.stringify({
                success: true,
                results: data,
                count: searchResults.length,
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
 * Perform keyword search using OpenAI API
 * Uses the same agent instructions from your Agent Builder
 */
async function performKeywordSearch(
    keywords: string,
    apiKey: string
): Promise<SearchResult[]> {

    console.log('Calling OpenAI for keyword search...')

    // Using the exact instructions from your Agent Builder agent
    const systemPrompt = `You are a Google Search Scraper Agent.

Your task is to:
1. Accept user-provided keywords and Google search operators.
2. Perform Google searches using those inputs.
3. Extract organic result URLs only (ignore ads, maps, featured snippets).
4. Return Minimum 10 results in a clean list of discovered URLs with:
   - the Company's verified URL
   - Page title (if available)
   - Snippet (if available)
   - Company Description/Details

Do NOT analyze content.
Do NOT validate language.
Do NOT score leads.
Do NOT return wikipedia links.
ONLY RETURN REAL COMPANY WEBSITES

Your output must be structured JSON in this exact format:
{
  "results": [
    {
      "url": "https://example.com",
      "company_name": "Company Name",
      "company_description": "Brief description of what the company does"
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
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: keywords }
            ],
            temperature: 1,
            max_tokens: 2048,
            response_format: { type: 'json_object' }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '{}'

    console.log('OpenAI response received')

    const parsed = JSON.parse(content)
    return parsed.results || []
}
