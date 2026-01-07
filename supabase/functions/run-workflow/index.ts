// Run Workflow - Main Entry Point
// Modular architecture for faster bundling and better maintainability

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { executeContextGatheringAgent } from './firecrawl.ts'
import { executeAuditWorkflow, JobReport } from './agents.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

// Concurrency limiter for multiple audit requests
class ConcurrencyLimiter {
    public activeRequests = 0
    private readonly maxConcurrent = 5
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

const concurrencyLimiter = new ConcurrencyLimiter()

interface WorkflowInput {
    input_as_text: string
    user_id: string
    job_id?: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let jobId: string | undefined

    try {
        const body = await req.text()
        console.log('Request received')

        const { input_as_text, user_id, job_id: providedJobId } = JSON.parse(body) as WorkflowInput
        jobId = providedJobId

        if (!input_as_text) throw new Error('input_as_text is required')
        if (!user_id) throw new Error('user_id is required')

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')

        const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
        if (!firecrawlApiKey) throw new Error('FIRECRAWL_API_KEY not configured')

        console.log('Starting audit for:', input_as_text)

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Extract URL
        let jobTitle = input_as_text
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)
        const targetUrl = urlMatch ? urlMatch[1] : input_as_text

        try {
            jobTitle = new URL(targetUrl).hostname
        } catch (e) { }

        // Create or update job
        if (jobId) {
            await supabaseClient.from('jobs').update({ status: 'processing', status_message: 'Initializing...' }).eq('id', jobId)
        } else {
            const { data: job, error: jobError } = await supabaseClient.from('jobs').insert({
                user_id, title: jobTitle, url: targetUrl, status: 'pending', status_message: 'Initializing...'
            }).select().single()

            if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)
            jobId = job.id
            console.log(`Job created: ${jobId}`)
        }

        // Check for cached data
        let cachedRawData: any = null
        if (jobId) {
            const { data: currentJob } = await supabaseClient.from('jobs').select('raw_data').eq('id', jobId).single()
            if (currentJob?.raw_data) {
                console.log('Found cached raw_data')
                cachedRawData = currentJob.raw_data
            }
        }

        // Setup status channel
        const statusChannel = jobId ? supabaseClient.channel(`job-status-${jobId}`) : null

        const updateStatus = async (msg: string) => {
            console.log(`[Status] ${msg}`)
            if (!jobId) return
            try {
                await supabaseClient.from('jobs').update({ status_message: msg, status: 'processing' }).eq('id', jobId)
                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: msg, status: 'processing', id: jobId } }, { httpSend: true })
                }
            } catch (e) {
                console.error('Status update error:', e)
            }
        }

        // Check concurrency
        if (concurrencyLimiter.activeRequests >= 5) {
            return new Response(JSON.stringify({ success: false, error: 'Server busy. Please try again.' }), { status: 429, headers: corsHeaders })
        }

        // Background processing
        const processAudit = (async () => {
            await concurrencyLimiter.acquire()

            try {
                await new Promise(r => setTimeout(r, 500))
                await updateStatus('Initializing Audit Squad...')

                // Context Gathering
                let scrapedContent = ''
                try {
                    await updateStatus('Crawling website...')
                    const contextData = await executeContextGatheringAgent(targetUrl, firecrawlApiKey, updateStatus)

                    if (contextData.pages) {
                        scrapedContent += contextData.pages.map((p: any) => `\n\n=== PAGE: ${p.title} ===\n${p.markdown || ''}`).join('\n\n')
                    }
                    if (contextData.contact) {
                        scrapedContent += `\n\n=== CONTACT ===\nEmail: ${contextData.contact.email}\nPhone: ${contextData.contact.phone}\n`
                    }
                    if (contextData.translationStructure) {
                        scrapedContent += `\n\n=== TRANSLATION ANALYSIS ===\n${contextData.translationStructure}\n`
                    }
                    console.log('Context gathered:', scrapedContent.length, 'chars')
                } catch (error) {
                    console.error('Context gathering failed:', error)
                    scrapedContent = `Context gathering failed: ${(error as Error).message}`
                    await updateStatus('Proceeding with limited data...')
                }

                if (!scrapedContent) scrapedContent = "Could not crawl content."

                // Execute Audit
                await updateStatus('Launching AI Auditors...')
                const auditReport = await executeAuditWorkflow(
                    targetUrl,
                    scrapedContent,
                    openaiApiKey,
                    updateStatus,
                    cachedRawData,
                    async (agentData) => {
                        if (jobId) {
                            await supabaseClient.from('jobs').update({ raw_data: agentData, status_message: 'Compiling report...' }).eq('id', jobId)
                        }
                    }
                )

                if (!auditReport || !auditReport.sections) {
                    throw new Error('Invalid report structure')
                }

                console.log('Report generated, score:', auditReport.score)

                // Save report
                const safeScore = typeof auditReport.score === 'number' ? auditReport.score : 0
                const { error: updateError } = await supabaseClient.from('jobs').update({
                    status: 'completed',
                    report: auditReport,
                    status_message: 'Audit completed!',
                    completed_at: new Date().toISOString(),
                    score: safeScore
                }).eq('id', jobId)

                if (updateError) throw new Error(`Failed to save report: ${updateError.message}`)

                console.log('Job updated successfully!')

                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: 'Audit completed!', status: 'completed', id: jobId } }, { httpSend: true })
                }

            } catch (error) {
                console.error('Audit error:', error)
                if (jobId) {
                    await supabaseClient.from('jobs').update({ status: 'failed', status_message: `Failed: ${(error as Error).message.substring(0, 100)}` }).eq('id', jobId)
                    if (statusChannel) {
                        await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: 'Failed', status: 'failed', id: jobId } }, { httpSend: true })
                    }
                }
            } finally {
                concurrencyLimiter.release()
                if (statusChannel) await supabaseClient.removeChannel(statusChannel)
            }
        })()

        // Event handlers for debugging
        addEventListener('beforeunload', (ev: any) => {
            console.log('⚠️ Function shutting down:', ev?.detail?.reason || 'unknown')
        })
        addEventListener('unhandledrejection', (event) => {
            console.error('❌ Unhandled rejection:', event.reason)
        })

        // Keep function alive
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            console.log('✅ Using EdgeRuntime.waitUntil')
            // @ts-ignore
            EdgeRuntime.waitUntil(processAudit)
        } else {
            console.log('⚠️ EdgeRuntime not available')
            processAudit.catch(e => console.error('Audit error:', e))
        }

        return new Response(JSON.stringify({ success: true, job_id: jobId, message: 'Audit started' }), { headers: corsHeaders })

    } catch (error) {
        console.error('Setup error:', error)
        return new Response(JSON.stringify({ success: false, error: `Setup failed: ${(error as Error).message}` }), { status: 200, headers: corsHeaders })
    }
})
