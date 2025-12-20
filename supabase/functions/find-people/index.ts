import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

interface SearchRequest {
    query: string
    user_id: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query, user_id } = await req.json() as SearchRequest

        if (!query) throw new Error('Query is required')
        if (!user_id) throw new Error('User ID is required')

        const exaApiKey = Deno.env.get('EXA_API_KEY')
        if (!exaApiKey) throw new Error('EXA_API_KEY not configured')

        console.log(`Searching for people with query: "${query}" for user: ${user_id}`)

        // 1. Call Exa.ai Search API
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'x-api-key': exaApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                type: 'auto',
                category: 'people',
                numResults: 5,
                contents: {
                    text: true,
                    highlights: true
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Exa.ai API Error:', errorText)
            throw new Error(`Exa.ai Search failed: ${response.statusText}`)
        }

        const data = await response.json()
        const results = data.results || []

        // 2. Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Save search to database
        const { error: dbError } = await supabaseClient
            .from('people_searches')
            .insert({
                user_id,
                query,
                results
            })

        if (dbError) {
            console.error('Database Error:', dbError)
            // We don't throw here to still return results to the user
        }

        return new Response(
            JSON.stringify({
                success: true,
                results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Find People Workflow error:', error)
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
