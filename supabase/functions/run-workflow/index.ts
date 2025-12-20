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
    salesEmail?: string
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

        // Step 1: Extract Language Signals (The "100% Fix" for Dropdowns)
        console.log('Extracting language signals from homepage...')
        let languageSignals = 'No explicit language signals found on homepage.'
        try {
            const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: targetUrl,
                    formats: ['extract'],
                    extract: {
                        schema: {
                            type: "object",
                            properties: {
                                hasLanguageSwitcher: { type: "boolean" },
                                availableLanguages: { type: "array", items: { type: "string" } },
                                hreflangTags: { type: "array", items: { type: "string" } },
                                switcherType: { type: "string", description: "dropdown, flags, footer links, etc." },
                                germanVersionUrl: { type: "string", description: "The direct URL to the German version if it exists." },
                                germanSelector: { type: "string", description: "CSS selector to click to switch to German (e.g., '.lang-de', 'button:has-text(\"DE\")')." }
                            },
                            required: ["hasLanguageSwitcher", "availableLanguages"]
                        }
                    }
                })
            })

            if (scrapeResponse.ok) {
                const scrapeData = await scrapeResponse.json()
                if (scrapeData.success && scrapeData.data?.extract) {
                    const ext = scrapeData.data.extract
                    languageSignals = `
                    HOMEPAGE LANGUAGE SIGNALS (EXTRACTED):
                    - Has Language Switcher: ${ext.hasLanguageSwitcher}
                    - Switcher Type: ${ext.switcherType || 'Unknown'}
                    - Available Languages: ${ext.availableLanguages?.join(', ') || 'None detected'}
                    - Hreflang Tags: ${ext.hreflangTags?.join(', ') || 'None detected'}
                    `
                    console.log('Language signals extracted:', ext)

                    // Step 1.5: Targeted German Content Scrape (The "Bulletproof" Part)
                    if (ext.hasLanguageSwitcher || ext.germanVersionUrl || ext.germanSelector) {
                        console.log('Detected German version entry point. Performing targeted scrape...')
                        try {
                            const germanScrapeUrl = ext.germanVersionUrl || targetUrl
                            const actions = ext.germanSelector ? [
                                { type: "wait", milliseconds: 1000 },
                                { type: "click", selector: ext.germanSelector },
                                { type: "wait", milliseconds: 2000 }
                            ] : []

                            const germanScrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${firecrawlApiKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    url: germanScrapeUrl,
                                    formats: ['markdown'],
                                    headers: {
                                        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
                                    },
                                    actions: actions.length > 0 ? actions : undefined
                                })
                            })

                            if (germanScrapeResponse.ok) {
                                const germanData = await germanScrapeResponse.json()
                                if (germanData.success && germanData.data?.markdown) {
                                    languageSignals += `\n\n=== TARGETED GERMAN CONTENT (SAMPLED) ===\n${germanData.data.markdown.substring(0, 5000)}\n`
                                    console.log('German content sampled successfully.')
                                }
                            }
                        } catch (error) {
                            console.error('Error during targeted German scrape:', error)
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during signal extraction:', error)
        }

        // Step 2: Crawl the entire website with Firecrawl
        let scrapedContent = languageSignals // Start with the signals
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
                        limit: 10, // Increased limit to find contact/legal pages better
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
                                    scrapedContent += '\n\n' + pages.map((page: any) => {
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

    const baseContext = `Analyze this website: ${url}\n\n[CONTEXT START]\n${scrapedContent.substring(0, 30000)}\n[CONTEXT END]`

    // 1. Impressum & AGB Specialist
    const agent1Instruction = `You are a German Legal Specialist. Focus on Impressum (Provider ID) and AGB (Terms). 
    Identify every missing mandatory element or non-compliant practice.
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem (source needed)
    - Recommendation: How to fix it
    - Severity: high/medium/low`

    // 2. Consumer Rights Specialist (Widerruf & Shipping)
    const agent2Instruction = `You are a Consumer Rights Expert. Focus on Right of Withdrawal (Widerrufsbelehrung) and Shipping costs/transparency.
    Identify every non-compliant practice or lack of transparency.
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem (source needed)
    - Recommendation: How to fix it
    - Severity: high/medium/low`

    // 3. Privacy Specialist (DSGVO)
    const agent3Instruction = `You are a Data Privacy Auditor (GDPR/DSGVO). Focus on Privacy Statements, Cookies, and Newsletters.
    Identify every missing requirement or dark pattern.
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem (source needed)
    - Recommendation: How to fix it
    - Severity: high/medium/low`

    // 4. UX & Sales Specialist (CTR Killers)
    const agent4Instruction = `You are a Conversion Expert (CTR Killers). Focus on usability, language consistency, and trust signals.
    Identify every barrier to conversion or professionalism.
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem
    - Recommendation: How to fix it
    - Severity: high/medium/low`

    // 5. Business Intelligence Specialist
    const agent5Instruction = `You are a Business Researcher. Extract Company Name, Industry, HQ, Founded, Size, Revenue (estimate is ok). 
    Find key leadership names, titles, LinkedIn profiles, and emails. Specifically look for the FOUNDER or MARKETING MANAGER. Use "Not found" for missing fields.`

    // 7. Sales Specialist (Dutch)
    const agent7Instruction = `You are a Helpful Expert Sales Consultant. Your goal is to draft a professional, helpful "cold" sales email in DUTCH to a founder or marketing manager.
    
    The email must focus on improving their international/German presence by pointing out ONE specific, embarrassing or high-impact language/localization error you found on their site (use the provided context).
    
    STRICT FORMAT for the core analysis part (must be in Dutch):
    Taalkundig/Raar: [One sentence explaining why the text is linguistically incorrect, strange, or awkward (grammar, spelling mistake, unnatural/literal translation, or language mix)]
    Red Flag/Conversie: [One sentence explaining why this error is a problem for international customers, focusing on the loss of trust, professionalism, or conversion]
    
    The email should be professional, empathetic, and offer help. Do not be overly aggressive.`

    // 6. Localization Specialist
    const agent6Instruction = `You are a German Localization Expert. 
    
    IMPORTANT: Look for "HOMEPAGE LANGUAGE SIGNALS" and "TARGETED GERMAN CONTENT (SAMPLED)" in the provided context. 
    The "TARGETED GERMAN CONTENT" is the actual text from the German version of the site. Use it to judge the quality of the translation.
    
    1. Detect and Confirm German Version:
       - Use "HOMEPAGE LANGUAGE SIGNALS" (URL patterns, switchers, hreflangs) to confirm if a German version exists.
    2. Deep Localization Analysis (using TARGETED GERMAN CONTENT):
       - Judge the quality of the German text.
       - Detect grammar errors, awkward phrasing, "machine translation" feel, or inconsistent terminology.
       - Identify sections that are still in English.
       - IMPORTANT: Provide specific examples of poor localization found in the sampled text.
    
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem (and examples of poor localization)
    - Recommendation: How to fix it
    - Severity: high/medium/low`

    console.log('Starting granular parallel analysis (6 Agents)...')

    const [res1, res2, res3, res4, res5, res6, res7] = await Promise.all([
        callOpenAI(apiKey, agent1Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent2Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent3Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent4Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent5Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent6Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5),
        callOpenAI(apiKey, agent7Instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.7)
    ])

    console.log('Granular analysis complete. Compiling final report...')

    const compilerMessages = [
        { role: 'user', content: baseContext },
        { role: 'assistant', content: `Impressum & AGB Analysis: ${res1}` },
        { role: 'assistant', content: `Consumer Rights & Shipping Analysis: ${res2}` },
        { role: 'assistant', content: `Privacy Analysis: ${res3}` },
        { role: 'assistant', content: `UX & CTR Analysis: ${res4}` },
        { role: 'assistant', content: `Company Research: ${res5}` },
        { role: 'assistant', content: `German Localization Analysis: ${res6}` },
        { role: 'assistant', content: `Dutch Sales Email Draft: ${res7}` }
    ]

    const compilerInstruction = `You are the Lead Auditor. Combine the provided analyses into a single, comprehensive JSON Deep Audit Report.
    Your goal is to produce a report with the same depth and structure as a professional manual audit.
    
    IMPORTANT: You MUST extract every specific problem identified by the specialists and format it into the "findings" array for the appropriate section.
    
    Structure:
    {
      "overview": "Detailed executive summary of the site's overall quality and legal risk.",
      "companyInfo": {
        "name": "...", "industry": "...", "hq_location": "...", "founded": 1999 | null, "employees": "...", "revenue": "...", 
        "contacts": [{ "name": "...", "title": "...", "linkedin": "...", "email": "..." }]
      },
      "sections": [
        { 
          "title": "Section Title", 
          "findings": [
            {
              "problem": "Concise title of the issue",
              "explanation": "Detailed explanation of WHY this is a problem, referencing sources like GDPR, IHK, or IONOS where mentioned by specialists.",
              "recommendation": "Step-by-step action to fix the issue.",
              "severity": "high" | "medium" | "low"
            }
          ] 
        }
      ],
      "conclusion": "Final wrap-up.",
      "actionList": ["Action 1", "Action 2", ...],
      "salesEmail": "The full drafted Dutch sales email text."
    }
    
    The sections SHOULD include: "Impressum & AGB", "Consumer Rights & Returns", "Shipping & Delivery", "Data Privacy (GDPR)", "UX & CTR Killers", and "German Localization".
    
    Return ONLY valid JSON. Ensure NO sections have empty findings if the specialists provided issues. 
    Do not include any text outside of the JSON object. The response must start with '{' and end with '}'.`

    const resCompiler = await callOpenAI(
        apiKey,
        compilerInstruction,
        compilerMessages,
        'gpt-4o',
        { type: "json_object" },
        0.1
    )

    try {
        // Find the first '{' and last '}' to extract the JSON object
        const firstBrace = resCompiler.indexOf('{')
        const lastBrace = resCompiler.lastIndexOf('}')

        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            console.error("No valid JSON object found in response:", resCompiler)
            throw new Error("AI response did not contain a valid JSON object")
        }

        const cleanJson = resCompiler.substring(firstBrace, lastBrace + 1)
        const parsed = JSON.parse(cleanJson)

        const totalFindings = parsed.sections?.reduce((acc: number, s: any) => acc + (s.findings?.length || 0), 0) || 0
        return { ...parsed, issuesCount: totalFindings }
    } catch (e) {
        console.error("JSON Parse Error. Raw response:", resCompiler)
        console.error(e)
        throw new Error("Failed to parse audit report")
    }
}

async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini',
    responseFormat?: { type: 'json_object' | 'text' },
    temperature: number = 0.7
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
            temperature: temperature,
            max_tokens: 4000,
            response_format: responseFormat
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
