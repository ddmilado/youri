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

interface AuditSection {
    title: string
    findings: Array<{
        problem: string
        explanation: string
        recommendation: string
        severity: 'high' | 'medium' | 'low'
    }>
}

interface Contact {
    name: string
    title: string
    linkedin?: string
    email?: string
}

interface CompanyInfo {
    name: string
    industry?: string
    hq_location?: string
    founded?: number
    employees?: string
    revenue?: string
    contacts: Contact[]
}

interface JobReport {
    overview: string
    sections: AuditSection[]
    conclusion: string
    actionList: string[]
    issuesCount?: number
    companyInfo?: CompanyInfo
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

        console.log('Starting Deep Audit workflow for input:', input_as_text)

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Step 0: Create initial Job entry
        let jobTitle = input_as_text
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)
        const targetUrl = urlMatch ? urlMatch[1] : input_as_text

        // Attempt to clean title from URL
        try {
            const urlObj = new URL(targetUrl)
            jobTitle = urlObj.hostname
        } catch (e) { }

        const { data: job, error: jobError } = await supabaseClient
            .from('jobs')
            .insert({
                user_id,
                title: jobTitle,
                url: targetUrl,
                status: 'processing'
            })
            .select()
            .single()

        if (jobError) {
            throw new Error(`Failed to create job: ${jobError.message}`)
        }

        const jobId = job.id
        console.log(`Job created with ID: ${jobId}`)

        // Start processing in background (but we wait for it here in this sync version for simplicity/demo)
        // In a real prod environment, you might decouple this.

        // Step 1: Crawl the entire website with Firecrawl
        let scrapedContent = ''
        let screenshotUrl = null

        if (targetUrl) {
            console.log('Crawling website:', targetUrl)

            try {
                // Start the crawl job
                const crawlResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${firecrawlApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: targetUrl,
                        limit: 5, // Limit pages to save time/cost for demo
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
                    const crawlJobId = crawlData.id || crawlData.jobId
                    console.log('Crawl job started:', crawlJobId)

                    if (crawlJobId) {
                        // Poll for crawl completion
                        let attempts = 0
                        const maxAttempts = 30 // 60 seconds max
                        while (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 2000))

                            const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlJobId}`, {
                                headers: { 'Authorization': `Bearer ${firecrawlApiKey}` }
                            })

                            if (statusResponse.ok) {
                                const statusData = await statusResponse.json()
                                if (statusData.status === 'completed') {
                                    console.log('Crawl completed! Pages:', statusData.data?.length)
                                    // Combine content
                                    const pages = statusData.data || []
                                    scrapedContent = pages.map((page: any) => {
                                        return `\n\n=== PAGE: ${page.metadata?.url || 'Unknown'} ===\n${page.markdown || ''}`
                                    }).join('\n\n')
                                    break
                                } else if (statusData.status === 'failed') {
                                    break
                                }
                            }
                            attempts++
                        }
                    }
                }
            } catch (error) {
                console.error('Error during crawling:', error)
            }
        }

        if (!scrapedContent) {
            scrapedContent = "Could not crawl content. Proceeding with limited analysis."
        }

        // Execute the Deep Audit Agent Workflow
        const auditReport = await executeAuditWorkflow(targetUrl, scrapedContent, openaiApiKey)

        // Update Job with result
        const { error: updateError } = await supabaseClient
            .from('jobs')
            .update({
                status: 'completed',
                report: auditReport,
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId)

        if (updateError) {
            console.error('Error updating job:', updateError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                job_id: jobId,
                message: 'Audit completed successfully'
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

async function executeAuditWorkflow(
    url: string,
    scrapedContent: string,
    apiKey: string
): Promise<JobReport> {

    const messages: Array<{ role: string; content: string }> = [
        {
            role: 'user',
            content: `Analyze this website: ${url}\n\n[CONTEXT START]\n${scrapedContent.substring(0, 50000)}\n[CONTEXT END]`
        }
    ]

    // Agent 1: Legal & Compliance
    console.log('Agent 1: Legal & Compliance')
    const agent1Instruction = `You are a German Legal Compliance Auditor for E-commerce.
    Analyze the provided website content for compliance with German laws (Impressum, Dataprivacy, AGB/Terms, Withdrawal Rights).
    Identify missing mandatory information (e.g. Handelsregister, VAT ID, Responsible Person, etc).
    
    Output a detailed analysis of the legal texts.`
    const res1 = await callOpenAI(apiKey, agent1Instruction, messages)
    messages.push({ role: 'assistant', content: res1 })

    // Agent 2: UX & Conversion
    console.log('Agent 2: UX & Conversion')
    const agent2Instruction = `You are an UX Expert.
    Analyze the website for conversion optimization and user experience issues, specifically for the German market.
    Look at: Language consistency, Trust signals, Shipping transparency, Payment options visibility.
    
    Output a detailed analysis.`
    const res2 = await callOpenAI(apiKey, agent2Instruction, messages)
    messages.push({ role: 'assistant', content: res2 })

    // Agent 3: Company & Contact Discovery
    console.log('Agent 3: Company & Contact Discovery')
    const agent3Instruction = `You are a Business Intelligence Researcher.
    Extract detailed information about the company behind this website:
    - Official Company Name
    - Industry/Niche
    - Headquarters Location
    - Year Founded
    - Employee Count (approximate)
    - Revenue (approximate, if available)
    - Key People: Extract names and job titles of company leaders, founders, or key management mentioned on the site or in legal texts.
    
    Output a detailed summary of the company profile and leadership.`
    const res3 = await callOpenAI(apiKey, agent3Instruction, messages)
    messages.push({ role: 'assistant', content: res3 })

    // Agent 4: Structure & Compile
    console.log('Agent 4: Compiler')
    const agent4Instruction = `You are the Lead Auditor.
    Based on the previous analyses, compile a Final Deep Audit Report in JSON format.
    
    The structure MUST be exactly:
    {
      "overview": "Executive summary of the audit state.",
      "companyInfo": {
        "name": "Full Company Name",
        "industry": "Industry description",
        "hq_location": "City, Country",
        "founded": 1999,
        "employees": "11-50",
        "revenue": "€1M-€5M",
        "contacts": [
          { "name": "John Doe", "title": "CEO", "linkedin": "optional", "email": "optional" }
        ]
      },
      "sections": [
        {
          "title": "Section Title (e.g. Legal, UX, etc)",
          "findings": [
            {
              "problem": "...",
              "explanation": "...",
              "recommendation": "...",
              "severity": "high" | "medium" | "low"
            }
          ]
        }
      ],
      "conclusion": "Final concluding remarks.",
      "actionList": ["Action item 1", "Action item 2"]
    }
    
    Return ONLY valid JSON. match the structure perfectly.`

    const res4 = await callOpenAI(apiKey, agent4Instruction, messages, 'gpt-4o') // Use gpt-4o for better JSON structure

    try {
        let cleanJson = res4.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
        const parsed = JSON.parse(cleanJson)
        const totalFindings = parsed.sections?.reduce((acc: number, s: any) => acc + (s.findings?.length || 0), 0) || 0
        return { ...parsed, issuesCount: totalFindings }
    } catch (e) {
        console.error("JSON Parse Error", e)
        throw new Error("Failed to parse audit report")
    }
}

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
        const t = await response.text()
        console.error("OpenAI Error:", t)
        throw new Error(t)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
}
