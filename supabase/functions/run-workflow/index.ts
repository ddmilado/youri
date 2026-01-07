// Import the Deno server library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS headers for allowing frontend requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

// Global concurrency control for multiple audit requests
class ConcurrencyLimiter {
    public activeRequests = 0 // Make this public so we can check it
    private readonly maxConcurrent = 5 // Allow up to 5 concurrent audits
    private queue: Array<() => void> = []

    async acquire(): Promise<void> {
        if (this.activeRequests < this.maxConcurrent) {
            this.activeRequests++
            return Promise.resolve()
        }

        return new Promise<void>((resolve) => {
            this.queue.push(resolve)
        })
    }

    release(): void {
        this.activeRequests--
        if (this.queue.length > 0) {
            const next = this.queue.shift()
            if (next) {
                this.activeRequests++
                next()
            }
        }
    }
}

// Global rate limiter for OpenAI API calls
class OpenAIRateLimiter {
    private lastCallTime = 0
    private callQueue: Array<() => void> = []
    private isProcessing = false
    private tokensUsedInWindow = 0
    private windowStartTime = Date.now()
    private readonly minInterval = 200 // 200ms between calls (GPT-5 handles concurrency well)
    private readonly maxTokensPerMinute = 400000 // Conservative limit (80% of 500k)
    private readonly windowDuration = 60000 // 1 minute window

    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.callQueue.push(resolve)
            this.processQueue()
        })
    }

    private async processQueue() {
        if (this.isProcessing || this.callQueue.length === 0) return

        this.isProcessing = true

        while (this.callQueue.length > 0) {
            const now = Date.now()

            // Reset token window if needed
            if (now - this.windowStartTime >= this.windowDuration) {
                this.tokensUsedInWindow = 0
                this.windowStartTime = now
            }

            // Check if we're approaching token limit
            if (this.tokensUsedInWindow > this.maxTokensPerMinute * 0.8) {
                const waitTime = this.windowDuration - (now - this.windowStartTime)
                if (waitTime > 0) {
                    console.log(`Token limit approaching: waiting ${waitTime}ms for window reset`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    this.tokensUsedInWindow = 0
                    this.windowStartTime = Date.now()
                }
            }

            // Time-based rate limiting (minimal for parallel execution)
            const timeSinceLastCall = now - this.lastCallTime
            if (timeSinceLastCall < this.minInterval) {
                const waitTime = this.minInterval - timeSinceLastCall
                await new Promise(resolve => setTimeout(resolve, waitTime))
            }

            const resolve = this.callQueue.shift()
            if (resolve) {
                this.lastCallTime = Date.now()
                // Estimate token usage (rough approximation)
                this.tokensUsedInWindow += 15000 // Conservative estimate per call
                resolve()
            }
        }

        this.isProcessing = false
    }
}

const concurrencyLimiter = new ConcurrencyLimiter()
const openaiRateLimiter = new OpenAIRateLimiter()

// Type definitions
interface WorkflowInput {
    input_as_text: string
    user_id: string
    job_id?: string
}

interface AuditSection {
    title: string
    findings: Array<{
        problem: string
        explanation: string
        recommendation: string
        severity: 'high' | 'medium' | 'low'
        sourceUrl?: string
        verificationNote: string
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
    email?: string
    phone?: string
    contacts: Contact[]
}

interface JobReport {
    overview: string
    sections: AuditSection[]
    conclusion: string
    actionList: string[]
    issuesCount?: number
    score?: number
    companyInfo?: CompanyInfo
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let jobId: string | undefined

    try {
        // Parse request payload
        const body = await req.text()
        console.log('Request body:', body)

        const { input_as_text, user_id, job_id: providedJobId } = JSON.parse(body) as WorkflowInput
        jobId = providedJobId

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

        // Step 0: Resolve or Create Job entry
        let jobTitle = input_as_text
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)
        const targetUrl = urlMatch ? urlMatch[1] : input_as_text

        // Attempt to clean title from URL
        try {
            const urlObj = new URL(targetUrl)
            jobTitle = urlObj.hostname
        } catch (e) { }

        if (jobId) {
            console.log(`Using provided Job ID: ${jobId}`)
            const { error: updateError } = await supabaseClient
                .from('jobs')
                .update({
                    status: 'processing',
                    status_message: 'Initializing audit...'
                })
                .eq('id', jobId)

            if (updateError) throw new Error(`Failed to update existing job: ${updateError.message}`)
        } else {
            const { data: job, error: jobError } = await supabaseClient
                .from('jobs')
                .insert({
                    user_id,
                    title: jobTitle,
                    url: targetUrl,
                    status: 'pending',
                    status_message: 'Initializing audit...'
                })
                .select()
                .single()

            if (jobError) {
                throw new Error(`Failed to create job: ${jobError.message}`)
            }
            jobId = job.id
            console.log(`New Job created with ID: ${jobId}`)
        }

        // Fetch existing raw_data if we have a jobId (for retries)
        let cachedRawData: any = null
        if (jobId) {
            const { data: currentJob } = await supabaseClient
                .from('jobs')
                .select('raw_data')
                .eq('id', jobId)
                .single()

            if (currentJob?.raw_data) {
                console.log('Found cached raw_data, will skip agent execution if possible.')
                cachedRawData = currentJob.raw_data
            }
        }

        // If not found in current job, check RECENT previous jobs for this URL
        if (!cachedRawData && targetUrl) {
            console.log('Checking for cached data from previous runs for URL:', targetUrl)
            const { data: recentJob } = await supabaseClient
                .from('jobs')
                .select('raw_data')
                .eq('url', targetUrl)
                .not('raw_data', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (recentJob?.raw_data) {
                console.log('Found recent cached raw_data for this URL! Resuming from cache.')
                cachedRawData = recentJob.raw_data
            }
        }

        // Initialize status channel for Broadcast (don't subscribe, just for sending)
        const statusChannel = jobId ? supabaseClient.channel(`job-status-${jobId}`) : null

        // Helper function for status updates
        const updateStatus = async (msg: string) => {
            console.log(`[Status Update] ${msg}`)
            if (!jobId || !statusChannel) return

            try {
                // 1. Persist to DB
                await supabaseClient
                    .from('jobs')
                    .update({ status_message: msg, status: 'processing' })
                    .eq('id', jobId)

                // 2. Broadcast in real-time
                await statusChannel.send({
                    type: 'broadcast',
                    event: 'status_update',
                    payload: { message: msg, status: 'processing', id: jobId }
                }, { httpSend: true })
            } catch (e) {
                console.error('Error in updateStatus:', e)
            }
        }

        // Check if we can accept this request (don't block, just check)
        // Reduce concurrent limit if we're hitting rate limits frequently
        const effectiveLimit = Math.min(5, Math.max(2, 5 - Math.floor(concurrencyLimiter.activeRequests / 2)))

        if (concurrencyLimiter.activeRequests >= effectiveLimit) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Server is currently processing the maximum number of concurrent audits (${effectiveLimit}). Please try again in a few minutes.`
                }),
                {
                    status: 429, // Too Many Requests
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // --- BACKGROUND PROCESSING START ---
        // We do NOT await this, but we use waitUntil to keep the process alive
        const processAudit = (async () => {
            // Acquire concurrency slot
            await concurrencyLimiter.acquire()

            try {
                // Delay slightly to ensure client has received the initial Response
                await new Promise(r => setTimeout(r, 500))

                // Start processing
                await updateStatus('Initializing 10-Agent Auditor Squad...')

                // Step 1: Agentic Context Gathering (Replaces signal scrape & dumb crawl)
                let scrapedContent = ''
                try {
                    await updateStatus('Agent: Investigating target URL for compliance & context...')
                    const contextData = await executeContextGatheringAgent(targetUrl, firecrawlApiKey, updateStatus)

                    // Format Pages
                    if (contextData.pages) {
                        scrapedContent += contextData.pages.map((p: any) =>
                            `\n\n=== PAGE: ${p.title} (${p.url}) ===\n${p.markdown || '(No content)'}`
                        ).join('\n\n')
                    }

                    // Format Contact Info
                    if (contextData.contact) {
                        scrapedContent += `\n\n=== EXTRACTED CONTACT INFO ===\nEmail: ${contextData.contact.email}\nPhone: ${contextData.contact.phone}\nAddress: ${contextData.contact.address || 'N/A'}\n`
                    }

                    // Format Company Details
                    if (contextData.company) {
                        scrapedContent += `\n\n=== COMPANY DETAILS ===\n${contextData.company.description}\n`
                    }

                    // Format Translation Structure Analysis
                    if (contextData.translationStructure) {
                        scrapedContent += `\n\n=== TRANSLATION STRUCTURE ANALYSIS ===\n${contextData.translationStructure}\n`
                    }

                    console.log('Agent context gathering complete. Content length:', scrapedContent.length)

                } catch (error) {
                    console.error('Context Gathering Agent failed:', error)
                    scrapedContent = `Agent failed to gather context: ${(error as Error).message}. Proceeding with fail-safe analysis.`
                    await updateStatus('Agent encountered resistance. Fallback protocols engaged.')
                }

                if (!scrapedContent) {
                    scrapedContent = "Could not crawl content. Proceeding with limited analysis."
                }

                console.log('=== FIRECRAWL COMPLETE, STARTING GPT ANALYSIS ===')
                console.log('Scraped content length:', scrapedContent.length)

                // Execute the Deep Audit Agent Workflow
                await updateStatus('Launching 10 Specialized AI Auditor Agents...')
                console.log('Calling executeAuditWorkflow...')

                let auditReport
                try {
                    auditReport = await executeAuditWorkflow(
                        targetUrl,
                        scrapedContent,
                        openaiApiKey,
                        updateStatus,
                        cachedRawData,
                        async (agentData) => {
                            if (jobId) {
                                console.log('Persisting intermediate agent data...')
                                await supabaseClient.from('jobs').update({
                                    raw_data: agentData,
                                    status_message: 'Agents finished. Compiling report...'
                                }).eq('id', jobId)
                            }
                        }
                    )
                    console.log('executeAuditWorkflow completed successfully')
                } catch (workflowError) {
                    console.error('executeAuditWorkflow failed:', workflowError)
                    throw workflowError
                }

                if (!auditReport) {
                    throw new Error('Audit workflow returned empty report')
                }

                console.log('Audit report generated, saving to database...')
                console.log('Report type:', typeof auditReport)
                console.log('Report keys:', Object.keys(auditReport || {}))
                console.log('Report overview:', auditReport.overview?.substring(0, 200))
                console.log('Report sections count:', auditReport.sections?.length)
                console.log('Report score:', auditReport.score)
                console.log('Full report JSON (first 1000 chars):', JSON.stringify(auditReport).substring(0, 1000))

                if (!auditReport || !auditReport.sections) {
                    console.error('Invalid audit report structure:', JSON.stringify(auditReport))
                    throw new Error('Audit report generated but structure is invalid (missing sections)')
                }

                const safeScore = (typeof auditReport.score === 'number' && !isNaN(auditReport.score)) ? auditReport.score : 0

                console.log('Updating job in database with report...')
                console.log('Job ID:', jobId)

                const { data: updateData, error: updateError } = await supabaseClient
                    .from('jobs')
                    .update({
                        status: 'completed',
                        report: auditReport,
                        status_message: 'Audit completed!',
                        completed_at: new Date().toISOString(),
                        score: safeScore
                    })
                    .eq('id', jobId)
                    .select()

                if (updateError) {
                    console.error('Error updating job:', updateError)
                    console.error('Update error details:', JSON.stringify(updateError))
                    throw new Error(`Failed to save report: ${updateError.message}`)
                }

                console.log('Job updated successfully!')
                console.log('Update result:', JSON.stringify(updateData))

                // Final broadcast
                if (statusChannel) {
                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: 'Audit completed!', status: 'completed', id: jobId }
                    }, { httpSend: true })
                }

            } catch (error) {
                console.error('Background Workflow error:', error)

                // Error handling with DB persistence
                if (jobId) {
                    try {
                        await supabaseClient.from('jobs').update({
                            status: 'failed',
                            status_message: `Analysis failed: ${(error as Error).message.substring(0, 100)}`
                        }).eq('id', jobId)

                        if (statusChannel) {
                            await statusChannel.send({
                                type: 'broadcast',
                                event: 'status_update',
                                payload: { message: 'Analysis failed', status: 'failed', id: jobId }
                            }, { httpSend: true })
                        }
                    } catch (e) {
                        console.error('Error updating failed status', e)
                    }
                }
            } finally {
                // Always release concurrency slot
                concurrencyLimiter.release()
                if (statusChannel) await supabaseClient.removeChannel(statusChannel)
            }
        })()

        // Start background processing - don't await
        const processAuditPromise = processAudit

        // Tell Edge Runtime to keep the process alive
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            // @ts-ignore
            EdgeRuntime.waitUntil(processAuditPromise)
            console.log('Using EdgeRuntime.waitUntil for background processing')
        } else {
            // Local dev: Fire and forget (do not await, otherwise client times out)
            console.log('Running in local mode - floating promise')
            processAuditPromise.catch(e => console.error('Floating audit error:', e))
        }

        // Always return immediately to the client
        return new Response(
            JSON.stringify({
                success: true,
                job_id: jobId,
                message: 'Audit processing started in background'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )

    } catch (error) {
        console.error('Setup error in run-workflow:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: `Setup failed: ${(error as Error).message}`
            }),
            {
                status: 200, // Return 200 even on setup error to avoid trigger-happy catch blocks in frontend, but with success: false
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})

async function executeAuditWorkflow(
    url: string,
    scrapedContent: string,
    apiKey: string,
    updateStatus: (msg: string) => Promise<void>,
    cachedData?: any,
    onAgentsComplete?: (data: any) => Promise<void>
): Promise<JobReport> {

    let fullData: any = {}
    try {
        fullData = typeof scrapedContent === 'string' ? JSON.parse(scrapedContent) : scrapedContent
    } catch (e) {
        fullData = { raw: scrapedContent }
    }

    // --- SMART CONTEXT TRUNCATION ---
    // Instead of substring-ing a huge JSON string (which breaks JSON syntax),
    // We strictly construct a valid object that fits within the limit.
    const contextLimit = 150000

    // 1. Always include critical analysis
    const safeContext: any = {
        translationStructure: fullData?.translationStructure || "Not available",
        company: fullData?.company || {},
        contact: fullData?.contact || {},
        pages: []
    }

    // 2. Add pages until we hit the limit
    let currentLength = JSON.stringify(safeContext).length
    const sourcePages = Array.isArray(fullData?.pages) ? fullData.pages : []

    for (const page of sourcePages) {
        // Safety check for page size
        const pSize = (page.markdown?.length || 0)
        if (currentLength + pSize + 200 > contextLimit) break
        safeContext.pages.push(page)
        currentLength += pSize + 50 // Approx overhead
    }

    const contextString = JSON.stringify(safeContext, null, 2)
    const baseContext = `Analyze this website: ${url}\n\n[CONTEXT START]\n${contextString}\n[CONTEXT END]`

    const agent1Instruction = `You are a German Legal Specialist. Focus on Impressum (Provider ID) and AGB (Terms). 
    Identify every missing mandatory element or non-compliant practice.
    For each issue found, provide:
    - Problem: Concise title
    - Explanation: Why it's a problem
    - Recommendation: How to fix it
    - Severity: high/medium/low
    - sourceUrl: The exact URL where you found (or should have found) this issue
    - verificationNote: Brief note like "Checked /impressum - missing VAT ID" or "Found on homepage footer"`

    const agent2Instruction = `You are a Consumer Rights Expert. Focus on Right of Withdrawal (Widerrufsbelehrung) and Shipping costs/transparency.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent3Instruction = `You are a Data Privacy Auditor (GDPR/DSGVO). Focus on Privacy Statements, Cookies, and Newsletters.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent4Instruction = `You are a Conversion Expert (CTR Killers). Focus on usability, language consistency, and trust signals.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent5Instruction = `You are a Business Researcher. Extract Company Name, Industry, HQ, Founded, Size, Revenue. 
    EXTREMELY IMPORTANT: Find official contact info (Email, Phone) and Key People.
    Include sourceUrl for where you found each piece of information.`

    const agent6Instruction = `You are a German Localization Specialist. Your goal is to strictly determine if the website is properly localized for the German market.
    
     1. **Structure Analysis (CRITICAL)**:
       - CHECK THE "TRANSLATION STRUCTURE ANALYSIS" SECTION IN THE CONTEXT FIRST.
       - **CASE A**: If it says "Client-Side Translation Widget CONFIRMED" or "Machine Translation":
         - **Finding**: "MACHINE TRANSLATION DETECTED / Client-Side Widget".
         - **Recommendation**: "IMMEDIATELY replace GTranslate/Automated widgets with robust Server-Side Localization. Hire a professional native translator."
         - **Severity**: High.
       - **CASE B**: If it says "No Localization Detected" or "Mono-Lingual":
         - **Finding**: "No German Localization Detected".
         - **Recommendation**: "Create a dedicated German version of the site (e.g. /de/ subdirectory) to enter the market."
         - **Severity**: High (if targeting Germany) or Medium.
       - **CASE C**: If "Detected Language Subdirectories" includes /de/:
         - Proceed to Quality Analysis.

    2. **Detection (Visual/Technical)**:
       - Look for URL patterns: \`/de/\`, \`de.\` subdomain, or \`?lang=de\`.
       - Look for Visual Elements: German flag icon, "DE" language switcher (header/footer).
       - Look for Technical Signals: \`<html lang="de">\`, \`hreflang="de"\`.
    
    3. **Quality Analysis (If German content exists)**:
       - "Native Feel" vs "Machine Translated": Look for grammar errors, awkward phrasing, or mixed English/German.
       - If "Sinn machen" or literal translation artifacts are found: **Finding**: "MACHINE TRANSLATION DETECTED (Linguistic Evidence)".
       - Legal: Are the "Impressum" and "AGB" actually in German?
    
    4. **Reporting Rules**:
       - *Avoid False Positives*: If you cannot find specific evidence, mark as "Not Localized".
       - *Citation*: For EVERY finding, you MUST provide the \`sourceUrl\` where you saw it and a \`verificationNote\` describing the evidence.
       - *Severity Rules*: 
         - Client-Side Translation (GTranslate) = HIGH severity (Bad for SEO).
         - Missing German Impressum = HIGH severity.
         - Mixed Languages on "German" page = MEDIUM severity.
    
    For each issue/finding, provide: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote. IF MACHINE TRANSLATION IS DETECTED, THE 'PROBLEM' FIELD MUST BE "MACHINE TRANSLATION DETECTED".`

    const agent7Instruction = `You are a Technical SEO Specialist. Focus on content hierarchy, meta tags, and technical signals.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent8Instruction = `You are a Psychological Trust Auditor. Focus on social proof and brand credibility.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent9Instruction = `You are a Checkout Process Specialist. Focus on the path to purchase and payment transparency.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent10Instruction = `You are a Price Transparency Auditor. Focus on how products are priced and promoted.
    For each issue found, provide: Problem, Explanation, Recommendation, Severity, sourceUrl (where you found it), verificationNote (brief evidence).`

    const agent11Instruction = `You are a Translation QA Expert.
    1. Select 3-5 key text samples from the provided content (e.g. Hero text, Value Props, About Us).
    2. Analyze them for:
       - **Machine Translation Artifacts**: Literal translations, Anglicisms (e.g., using "Sinn machen" instead of "Sinn ergeben" in formal contexts), or awkward phrasing.
       - **Context Errors**: Words that are translated correctly but used in the wrong context (e.g., "Home" translated as "Zuhause" on a nav bar instead of "Startseite").
       - **Untranslated Text**: English segments remaining on the German page.
       - **Inconsistencies**: Mixing formal "Sie" and informal "Du".
       - **Cross-Check**: If you see both English (/en/) and German (/de/) versions of the same page in the context, compare them. Does the German version capture the nuance, or is it a flat translation?
    
    For each issue, provide: Problem, Explanation, Recommendation, Severity, sourceUrl.`

    // Variables to hold results
    let res1, res2, res3, res4, res5, res6, res7, res8, res9, res10, res11

    if (cachedData) {
        await updateStatus('Restoring previous agent findings from database...')
        console.log('Using cached agent data')
        res1 = cachedData.legal
        res2 = cachedData.consumer
        res3 = cachedData.privacy
        res4 = cachedData.ux
        res5 = cachedData.company
        res6 = cachedData.localization
        res7 = cachedData.seo
        res8 = cachedData.trust
        res9 = cachedData.checkout
        res10 = cachedData.price
        res11 = cachedData.translationQuality
    } else {
        await updateStatus('Deploying 11 specialized AI Auditor Agents for granular analysis...')
        console.log('Starting granular analysis (11 Agents)...')

        // Run agents in parallel batches for speed
        // GPT-5 can handle concurrent requests better than sequential
        console.log('Running agents in parallel batches...')
        await updateStatus('Running specialized agents in parallel...')

        const callAgent = async (instruction: string, name: string) => {
            console.log(`[Agent ${name}] Starting...`)
            try {
                // Using gpt-4o-mini for agents (fast, reliable, efficient)
                const res = await callOpenAI(apiKey, instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5)
                if (!res || res.length === 0) {
                    console.warn(`[Agent ${name}] Returned empty response, using placeholder`)
                    return `Agent ${name} analysis: No specific issues found or analysis unavailable.`
                }
                console.log(`[Agent ${name}] Finished with ${res.length} chars.`)
                return res
            } catch (e) {
                console.error(`[Agent ${name}] Failed:`, e)
                return `Agent ${name} analysis: Analysis could not be completed. Please review manually.`
            }
        }

        // Batch 1: Run first 5 agents in parallel
        await updateStatus('Agents 1-5: Legal, Consumer, Privacy, UX, Company...')
        const results1 = await Promise.all([
            callAgent(agent1Instruction, 'Legal'),
            callAgent(agent2Instruction, 'Consumer Rights'),
            callAgent(agent3Instruction, 'Privacy'),
            callAgent(agent4Instruction, 'UX'),
            callAgent(agent5Instruction, 'Company Info')
        ])
        res1 = results1[0]; res2 = results1[1]; res3 = results1[2]; res4 = results1[3]; res5 = results1[4];

        // Batch 2: Run remaining 6 agents in parallel
        await updateStatus('Agents 6-11: Localization, SEO, Trust, Checkout, Price, Translation QA...')
        const results2 = await Promise.all([
            callAgent(agent6Instruction, 'Localization'),
            callAgent(agent7Instruction, 'SEO'),
            callAgent(agent8Instruction, 'Trust'),
            callAgent(agent9Instruction, 'Checkout'),
            callAgent(agent10Instruction, 'Price Transparency'),
            callAgent(agent11Instruction, 'Translation QA')
        ])
        res6 = results2[0]; res7 = results2[1]; res8 = results2[2]; res9 = results2[3]; res10 = results2[4]; res11 = results2[5];
    }

    // Save/Checkpoint results
    const allAgentData = {
        legal: res1, consumer: res2, privacy: res3, ux: res4, company: res5,
        localization: res6, seo: res7, trust: res8, checkout: res9, price: res10, translationQuality: res11
    }

    if (onAgentsComplete) {
        await onAgentsComplete(allAgentData)
    }

    console.log('Granular analysis complete. Compiling final report...')
    console.log('Agent response lengths:', {
        legal: res1?.length || 0,
        consumer: res2?.length || 0,
        privacy: res3?.length || 0,
        ux: res4?.length || 0,
        company: res5?.length || 0,
        localization: res6?.length || 0,
        seo: res7?.length || 0,
        trust: res8?.length || 0,
        checkout: res9?.length || 0,
        price: res10?.length || 0,
        translation: res11?.length || 0
    })

    // Ensure all responses are valid strings
    const safeRes = (r: any) => (r && typeof r === 'string' && r.length > 0) ? r : 'No analysis available.'
    const safe1 = safeRes(res1)
    const safe2 = safeRes(res2)
    const safe3 = safeRes(res3)
    const safe4 = safeRes(res4)
    const safe5 = safeRes(res5)
    const safe6 = safeRes(res6)
    const safe7 = safeRes(res7)
    const safe8 = safeRes(res8)
    const safe9 = safeRes(res9)
    const safe10 = safeRes(res10)
    const safe11 = safeRes(res11)

    await updateStatus('Analysis complete. Consolidating agent findings into final report...')

    // Truncate agent responses to avoid timeout - compiler only needs summaries
    // Reduced from 8000 to 2000 to ensure we don't hit token limits or timeouts during compilation
    const truncate = (s: string, max: number = 2000) => s.length > max ? s.substring(0, max) + '...[truncated]' : s

    const compilerMessages = [
        { role: 'user', content: `Compile a comprehensive audit report for: ${url}` },
        { role: 'assistant', content: `Legal (Impressum/AGB): ${truncate(safe1)}` },
        { role: 'assistant', content: `Consumer Rights: ${truncate(safe2)}` },
        { role: 'assistant', content: `GDPR & Privacy: ${truncate(safe3)}` },
        { role: 'assistant', content: `UX & CTR: ${truncate(safe4)}` },
        { role: 'assistant', content: `Company Stats: ${truncate(safe5)}` },
        { role: 'assistant', content: `Localization Quality: ${truncate(safe6)}` },
        { role: 'assistant', content: `SEO & Technical: ${truncate(safe7)}` },
        { role: 'assistant', content: `Trust & Social Proof: ${truncate(safe8)}` },
        { role: 'assistant', content: `Checkout & Payments: ${truncate(safe9)}` },
        { role: 'assistant', content: `Price Transparency: ${truncate(safe10)}` },
        { role: 'assistant', content: `Translation Quality: ${truncate(safe11)}` }
    ]

    const compilerInstruction = `You are the Lead Auditor. Combine the provided analyses into a single, comprehensive JSON Deep Audit Report.
    
    YOU MUST RESPOND WITH ONLY VALID JSON. No markdown, no code blocks, no explanations.
    
    Required JSON Structure:
    {
      "overview": "Detailed executive summary of the audit findings...",
      "companyInfo": { "name": "Company Name", "industry": "Industry", "hq_location": "Location", "email": "email@example.com", "phone": "+1234567890" },
    "sections": [ 
      { "title": "Legal & Compliance", "findings": [...] },
      { "title": "Consumer Rights", "findings": [...] },
      { "title": "Data Privacy", "findings": [...] },
      { "title": "UX & Conversion", "findings": [...] },
      { "title": "Company Info Audit", "findings": [...] },
      { "title": "Localization Quality", "findings": [...] },
      { "title": "Translation Quality Audit", "findings": [...] },
      { "title": "SEO & Technical", "findings": [...] },
      { "title": "Trust & Social Proof", "findings": [...] },
      { "title": "Checkout & Payments", "findings": [...] },
      { "title": "Price Transparency", "findings": [...] }
    ],
      "conclusion": "Overall conclusion and summary...",
      "actionList": ["Priority action 1", "Priority action 2", "Priority action 3"]
    }
    
    CRITICAL RULES:
    1. EVERY finding MUST have all fields: problem, explanation, recommendation, severity, sourceUrl, verificationNote
    2. severity MUST be one of: "high", "medium", "low"
    3. Start your response with { and end with }
    4. **TRANSLATION CHECK**: If any agent reports "Client-Side Translation", "Machine Translation", or "GTranslate", you MUST: 
       a) Include "Hire a professional native translator to review all content" as one of the top items in the 'actionList'.
       b) Ensure the finding title/problem explicitly says "MACHINE TRANSLATION DETECTED" in the "Localization Quality" section.
    5. Do NOT include any text before or after the JSON`

    console.log('Calling compiler with', compilerMessages.length, 'messages')
    console.log('Total content size for compiler:', compilerMessages.reduce((acc, m) => acc + m.content.length, 0), 'chars')

    let resCompiler
    try {
        resCompiler = await callOpenAI(
            apiKey,
            compilerInstruction,
            compilerMessages,
            'gpt-4o', // Using gpt-4o for the most reliable JSON compilation
            { type: "json_object" },
            0.1,
            16000 // Increased token limit for large reports
        )
    } catch (compilerError) {
        console.error('Compiler failed or timed out:', compilerError)
        console.error('Safe9 content length:', safe11 ? safe11.length : 'undefined')
        console.log('Falling back to raw data constructions...')

        // Raw output logging
        console.log('RAW AGENT 11 (Translation):', safe11)

        // Fallback: Construct a basic JSON from raw agent data so the user gets SOMETHING
        throw new Error(`Compiler Failure: ${(compilerError as Error).message}`)
    }


    console.log('Compiler response received, length:', resCompiler?.length || 0)

    try {
        const firstBrace = resCompiler.indexOf('{')
        const lastBrace = resCompiler.lastIndexOf('}')
        console.log('Compiler response length:', resCompiler.length)
        console.log('First 500 chars of compiler response:', resCompiler.substring(0, 500))

        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            console.error('Invalid JSON structure in compiler response')
            console.error('Full response:', resCompiler)
            throw new Error('AI response did not contain valid JSON. Please retry the audit.')
        }

        const cleanJson = resCompiler.substring(firstBrace, lastBrace + 1)
        console.log('Attempting to parse JSON of length:', cleanJson.length)

        let parsed
        try {
            parsed = JSON.parse(cleanJson)
        } catch (parseError) {
            console.error('JSON parse error:', parseError)
            console.error('Attempted to parse:', cleanJson.substring(0, 1000))

            // Try to fix common JSON issues
            let fixedJson = cleanJson
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters

            try {
                parsed = JSON.parse(fixedJson)
                console.log('Successfully parsed after fixing JSON')
            } catch (e) {
                throw new Error(`Failed to parse AI response as JSON: ${(parseError as Error).message}`)
            }
        }

        console.log('Successfully parsed JSON with sections:', parsed.sections?.length || 0)

        const sections = parsed.sections || []
        const totalFindings = sections.reduce((acc: number, s: any) => acc + (s.findings?.length || 0), 0) || 0
        const sectionScores = sections.map((section: any) => {
            let sScore = 100
            section.findings?.forEach((finding: any) => {
                const sev = finding.severity?.toLowerCase()
                if (sev === 'high' || sev === 'critical') sScore -= 25
                else if (sev === 'medium') sScore -= 10
                else if (sev === 'low') sScore -= 4
            })
            return Math.max(0, sScore)
        })
        let calculatedScore = 100
        if (sectionScores.length > 0) {
            const sum = sectionScores.reduce((a: number, b: number) => a + b, 0)
            calculatedScore = Math.round(sum / sectionScores.length)
        }
        calculatedScore = Math.max(5, calculatedScore)

        const finalReport = { ...parsed, issuesCount: totalFindings, score: calculatedScore }
        console.log('Final report created with score:', calculatedScore, 'and', totalFindings, 'findings')
        return finalReport
    } catch (e) {
        console.error('Failed to parse audit report:', e)
        console.error('Raw compiler response:', resCompiler)
        throw new Error(`Failed to generate audit report: ${(e as Error).message}`)
    }
}

async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini',
    responseFormat?: { type: 'json_object' | 'text' },
    temperature: number = 0.7,
    maxTokens: number = 4000,
    retries: number = 5
): Promise<string> {

    // Wait for rate limiter before making the call
    await openaiRateLimiter.acquire()

    // Use Chat Completions API for all models (GPT-5 supports it with reasoning_effort parameter)
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ]

    const requestBody: any = {
        model: model,
        messages,
    }

    // Standard Chat Completions parameters
    requestBody.temperature = temperature
    requestBody.max_tokens = maxTokens

    if (responseFormat) {
        requestBody.response_format = responseFormat
        if (responseFormat.type === 'json_object' && !systemPrompt.includes('JSON')) {
            // OpenAI requires the word 'JSON' in the system prompt for json_object mode
            messages[0].content = systemPrompt + "\n\nIMPORTANT: You must output valid JSON."
        }
    }

    try {
        console.log(`Calling OpenAI with model: ${model} (max_tokens: ${maxTokens})`)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error(`OpenAI API error [${response.status}]: ${error}`)

            // Retry logic for 429s or 5xx
            if (retries > 0 && (response.status === 429 || response.status >= 500)) {
                console.log(`Retrying OpenAI call... (${retries} attempts left)`)
                await new Promise((resolve) => setTimeout(resolve, 2000))
                return callOpenAI(apiKey, systemPrompt, conversationHistory, model, responseFormat, temperature, maxTokens, retries - 1)
            }
            throw new Error(`OpenAI API Error: ${response.statusText} - ${error}`)
        }

        const data = await response.json()
        let content = data.choices[0].message.content

        // Strip markdown code blocks if present (even in json_object mode, sometimes they appear)
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '')
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '')
        }

        return content.trim()

    } catch (error) {
        if (retries > 0) {
            console.warn(`OpenAI call failed, retrying... (${retries} left)`, error)
            await new Promise((resolve) => setTimeout(resolve, 3000))
            return callOpenAI(apiKey, systemPrompt, conversationHistory, model, responseFormat, temperature, maxTokens, retries - 1)
        }
        throw error
    }


}


/**
 * Crawl website using Firecrawl's crawl endpoint (cheaper than agent)
 * Automatically discovers and scrapes relevant pages
 */
/**
 * Crawl website using Firecrawl's crawl endpoint (cheaper than agent)
 * Automatically discovers and scrapes relevant pages
 * ALSO measures translation structure (Map + 404 checks)
 */
async function executeContextGatheringAgent(
    targetUrl: string,
    apiKey: string,
    updateStatus: (msg: string) => Promise<void>
): Promise<any> {
    console.log(`Starting Context Gathering for: "${targetUrl}"`)

    // --- PARALLEL EXECUTION: Crawl + Map/Structure Analysis ---

    // 1. Start Crawl Job
    const crawlPromise = (async () => {
        await updateStatus('Crawling website for relevant pages...')
        const startResponse = await fetch('https://api.firecrawl.dev/v2/crawl', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: targetUrl,
                limit: 30,
                scrapeOptions: { formats: ['markdown', 'html'] }
            })
        })

        if (!startResponse.ok) throw new Error(`Failed to start crawl: ${await startResponse.text()}`)

        const startData = await startResponse.json()
        if (startData.status === 'completed' && startData.data) return startData.data

        const jobId = startData.id
        if (!jobId) throw new Error('No Job ID received from Firecrawl')

        // Poll
        const maxTime = 120000
        const startTime = Date.now()
        while (Date.now() - startTime < maxTime) {
            await new Promise(r => setTimeout(r, 3000))
            const statusRes = await fetch(`https://api.firecrawl.dev/v2/crawl/${jobId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (statusRes.ok) {
                const sData = await statusRes.json()
                if (sData.status === 'completed') return sData.data
                if (sData.status === 'failed') throw new Error(sData.error || 'Crawl failed')
                await updateStatus(`Crawling... ${sData.completed || 0}/${sData.total || 0} pages`)
            }
        }
        throw new Error('Crawl timed out')
    })()

    // 2. Start Map & Structure Analysis
    const structurePromise = (async () => {
        await updateStatus('Analyzing URL structure for translation patterns...')
        try {
            // Map
            const mapResponse = await fetch('https://api.firecrawl.dev/v2/map', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    search: "",
                    ignoreQueryParameters: true,
                    limit: 2000
                })
            })

            let urls: string[] = []
            if (mapResponse.ok) {
                const mapData = await mapResponse.json()
                if (mapData.success && mapData.links) {
                    urls = mapData.links
                }
            }

            // Analyze Structure
            const commonLangCodes = ['/en/', '/fr/', '/de/', '/es/', '/it/', '/nl/', '/pt/', '/ru/', '/zh/', '/ja/']
            const foundSubdirs = commonLangCodes.filter(code => urls.some(u => u.includes(code)))

            let structureNote = `Total Mapped URLs: ${urls.length}\n`

            if (foundSubdirs.length > 0) {
                structureNote += `Detected Language Subdirectories: ${foundSubdirs.join(', ')}\n`
                structureNote += `Conclusion: Server-Side Translation (likely robust).`
            } else {
                // Check for 404s to detect Client-Side (GTranslate)
                const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl
                const testPaths = ['/fr', '/de', '/es']
                let failedCount = 0

                for (const path of testPaths) {
                    try {
                        const res = await fetch(`${baseUrl}${path}`, { method: 'HEAD' })
                        if (res.status === 404) failedCount++
                    } catch (e) { failedCount++ }
                }

                if (failedCount === testPaths.length) {
                    structureNote += `Detected Language Subdirectories: None\n`
                    structureNote += `Language Path Check: /fr, /de, /es all returned 404.\n`
                    structureNote += `Conclusion: Client-Side Translation (e.g., GTranslate plugin) or Single Language Site.\n`
                    structureNote += `WARN: If this is an international company, this indicates POOR localization (JavaScript-based replacement).`
                } else {
                    structureNote += `Detected Language Subdirectories: None, but some language paths exist implicitly or via parameters.`
                }
            }
            return structureNote
        } catch (err) {
            console.error('Structure analysis failed:', err)
            return "Structure analysis failed."
        }
    })()

    // Wait for both
    let crawlData = []
    let structureData = ""

    try {
        const [cData, sData] = await Promise.all([crawlPromise, structurePromise])
        crawlData = cData
        structureData = sData
    } catch (e) {
        console.error('Error in context gathering:', e)
        // Fallback: try to return whatever we got, or empty
        await updateStatus('Partial context gathering failure. Proceeding...')
    }

    // --- STEP 3: ANALYZE HTML FOR WIDGETS ---
    // We now have the HTML from the crawl (if successful). Let's scan for GTranslate.
    try {
        const homePage = crawlData.find((p: any) => {
            const u = (p.metadata?.sourceURL || '').toLowerCase()
            // Try to find the root or near-root page
            return u === targetUrl.toLowerCase() || u === targetUrl.toLowerCase() + '/'
        }) || crawlData[0] // Fallback to first page

        if (homePage && homePage.html) {
            const html = homePage.html.toLowerCase()

            // 1. Check for Machine Translation signatures (Broad)
            const signatures = [
                'gtranslate',
                'goog-te-combo',
                'google_translate_element',
                'goog-te-menu-frame',
                'translate.google.com',
                'gtranslate.io',
                'wp-google-translate', // common plugin
                'translate="no"', // often paired with widgets
                'class="notranslate"'
            ]

            // Find which signature triggered it
            const foundSignature = signatures.find(sig => html.includes(sig))

            if (foundSignature) {
                // 2. Extract Languages (Heuristic)
                const potentialLangs = []
                if (html.includes('lang="de"')) potentialLangs.push('German')
                if (html.includes('lang="fr"')) potentialLangs.push('French')

                // 3. Confirm Conflict: Widget + NO Subdirectories
                const noSubdirsDetected = structureData.includes('Detected Language Subdirectories: None')

                if (noSubdirsDetected) {
                    structureData = "" // Reset standard structure data
                    structureData += `CRITICAL: Client-Side Translation Widget CONFIRMED.\n`
                    structureData += `Evidence: Found Machine Translation marker '${foundSignature}' in homepage HTML.\n`
                    structureData += `Context: No server-side language subdirectories (/de/, /fr/) found in URL map.\n`
                    structureData += `Conclusion: Website relies on JavaScript injection for translation (Machine Translation).\n`
                    if (potentialLangs.length > 0) {
                        structureData += `Widget Languages Detected: ${potentialLangs.join(', ')}\n`
                    }
                } else {
                    structureData += `\nNOTE: Found Translation Widget ('${foundSignature}'), BUT subdirectories ALSO exist. Hybrid approach detected.`
                }
            } else {
                // NO Widget Found
                if (structureData.includes('Detected Language Subdirectories: None')) {
                    // Update the conclusion to be safer
                    structureData += `\nHTML Check: No GTranslate/Machine Translation widgets found in source.\n`
                    structureData += `Final Conclusion: Site appears to be Mono-Lingual (No Localization Detected).`
                } else {
                    structureData += `\nHTML Check: Clean (No Client-Side widgets detected).`
                }
            }
        }
    } catch (err) {
        console.warn('Widget HTML analysis error:', err)
    }

    const formatted = formatCrawlResults(crawlData)
    // IMPORTANT: Put translationStructure FIRST so it doesn't get truncated if context is huge
    return {
        translationStructure: structureData,
        ...formatted
    }
}

/**
 * Format crawl results into our expected structure
 */
function formatCrawlResults(data: any[]): any {
    if (!Array.isArray(data)) {
        console.warn('Crawl data is not an array:', typeof data)
        return { pages: [], contact: {}, company: {} }
    }

    const pages = data.map((item: any) => ({
        title: item.metadata?.title || 'Page',
        url: item.metadata?.sourceURL || '',
        markdown: (item.markdown || '').substring(0, 4000), // Limit size per page to stay within token limits
        // We do NOT pass HTML to agents to save tokens, we only used it for the structure analysis above
    }))

    // Try to extract contact info from all pages
    let email = ''
    let phone = ''

    for (const item of data) {
        const content = item.markdown || ''

        // Find email
        if (!email) {
            const emailMatch = content.match(/[\w.-]+@[\w.-]+\.\w+/)
            if (emailMatch) email = emailMatch[0]
        }

        // Find phone (German format)
        if (!phone) {
            const phoneMatch = content.match(/(\+49|0049|0)\s*[\d\s\-\/]{8,}/)
            if (phoneMatch) phone = phoneMatch[0].trim()
        }
    }

    return {
        pages,
        contact: { email, phone, address: '' },
        company: {}
    }
}
