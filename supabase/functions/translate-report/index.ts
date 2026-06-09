import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

interface TranslateReportRequest {
    report: unknown
    target_language?: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { report, target_language = 'Dutch' } = await req.json() as TranslateReportRequest
        if (!report) throw new Error('report is required')

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: Deno.env.get('OPENAI_TRANSLATION_MODEL') || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You translate website audit reports into ${target_language}.

Return ONLY valid JSON with the exact same object structure and keys as the input.
Translate human-readable report prose, including overview, section titles, problems, explanations, recommendations, verification notes, conclusion, actionList, and descriptive company fields.
Do NOT translate URLs, email addresses, phone numbers, sourceUrl values, sourceSnippet values, legal identifiers, company names, personal names, or code-like values.
Preserve severity, confidence, score, arrays, booleans, nulls, and all unknown fields exactly.`
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(report)
                    }
                ],
                temperature: 0.2,
                max_tokens: 12000,
                response_format: { type: 'json_object' },
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenAI translation error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || '{}'
        const translatedReport = JSON.parse(content)

        return new Response(
            JSON.stringify({ success: true, report: translatedReport }),
            { headers: corsHeaders }
        )
    } catch (error) {
        console.error('translate-report error:', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: corsHeaders }
        )
    }
})
