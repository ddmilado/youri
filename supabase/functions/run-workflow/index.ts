// Run Workflow - Main Entry Point
// Two-Phase Architecture: Phase 1 (Crawl) -> Phase 2 (Analysis)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { executeAuditWorkflow, JobReport } from './agents.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

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
    is_callback?: boolean // Flag to indicate completion of Phase 1
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let jobIdForFailure: string | undefined
    let supabaseForFailure: any = null

    try {
        const body = await req.json() as WorkflowInput
        const { input_as_text, user_id, job_id: providedJobId, is_callback } = body

        let jobId = providedJobId
        jobIdForFailure = providedJobId

        if (!input_as_text) throw new Error('input_as_text is required')
        if (!user_id) throw new Error('user_id is required')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        supabaseForFailure = supabaseClient

        // Extract URL
        const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i)
        const targetUrl = urlMatch ? urlMatch[1] : input_as_text

        // 1. Job Management
        if (!jobId) {
            let jobTitle = targetUrl
            try { jobTitle = new URL(targetUrl).hostname } catch (e) { }

            const { data: job, error: jobError } = await supabaseClient.from('jobs').insert({
                user_id, title: jobTitle, url: targetUrl, status: 'pending', status_message: 'Initializing...'
            }).select().single()

            if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)
            jobId = job.id
            jobIdForFailure = job.id
        }

        // 2. Phase Detection (Crawl vs Analysis)
        const { data: currentJob, error: currentJobError } = await supabaseClient
            .from('jobs')
            .select('raw_data, crawl_status')
            .eq('id', jobId)
            .single()

        if (currentJobError || !currentJob) {
            throw new Error(`Job not found or unavailable: ${currentJobError?.message || jobId}`)
        }

        const hasCrawlData = currentJob?.raw_data?.pages && currentJob.raw_data.pages.length > 0

        if (!hasCrawlData) {
            // PHASE 1: START CRAWL AND RETURN IMMEDIATELY
            console.log(`[Phase 1] Triggering crawler for job ${jobId}`)

            await supabaseClient.from('jobs').update({
                status: 'processing',
                status_message: 'Crawling website...',
                crawl_status: 'crawling'
            }).eq('id', jobId)

            const crawlerTrigger = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crawler`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ job_id: jobId, url: targetUrl, user_id: user_id })
            }).then(async (response) => {
                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('Crawler trigger failed:', errorText)
                    await supabaseClient.from('jobs').update({
                        status: 'failed',
                        crawl_status: 'failed',
                        status_message: `Crawler failed to start: ${errorText.substring(0, 120)}`
                    }).eq('id', jobId)
                }
            }).catch(async (e) => {
                console.error('Crawler trigger failed:', e)
                await supabaseClient.from('jobs').update({
                    status: 'failed',
                    crawl_status: 'failed',
                    status_message: `Crawler failed to start: ${(e as Error).message.substring(0, 120)}`
                }).eq('id', jobId)
            })

            // @ts-ignore
            if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
                // @ts-ignore
                EdgeRuntime.waitUntil(crawlerTrigger)
            }

            return new Response(JSON.stringify({
                success: true,
                job_id: jobId,
                phase: 'crawling',
                message: 'Crawl phase started. Function will restart for analysis once crawl completes.'
            }), { headers: corsHeaders })
        }

        // PHASE 2: RUN AI ANALYSIS
        console.log(`[Phase 2] Starting AI analysis for job ${jobId}`)

        // Background processing for Phase 2
        const processPhase2 = (async () => {
            await concurrencyLimiter.acquire()
            const statusChannel = jobId ? supabaseClient.channel(`job-status-${jobId}`) : null

            const updateStatus = async (msg: string) => {
                console.log(`[Phase 2 Status] ${msg}`)
                await supabaseClient.from('jobs').update({ status_message: msg, status: 'processing' }).eq('id', jobId)
                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: msg, status: 'processing', id: jobId } }, { httpSend: true })
                }
            }

            try {
                const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
                if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')

                await updateStatus('Launching AI Auditors...')

                // Pass the structured crawl payload through to the agent workflow.
                // The agent runner prioritizes legal pages, contact data, and RAG verification from this shape.
                const contextData = currentJob.raw_data

                // Execute Audit
                const auditReport = await executeAuditWorkflow(
                    targetUrl,
                    contextData,
                    openaiApiKey,
                    updateStatus,
                    null, // No cached agent data initially
                    async (agentData) => {
                        await supabaseClient.from('jobs').update({ status_message: 'Compiling report...' }).eq('id', jobId)
                    },
                    jobId
                )

                if (!auditReport || !auditReport.sections) throw new Error('Invalid report structure')

                // Save Final Report
                const safeScore = typeof auditReport.score === 'number' ? auditReport.score : 0
                await supabaseClient.from('jobs').update({
                    status: 'completed',
                    report: auditReport,
                    status_message: 'Audit completed!',
                    completed_at: new Date().toISOString(),
                    score: safeScore
                }).eq('id', jobId)

                if (statusChannel) {
                    await statusChannel.send({ type: 'broadcast', event: 'status_update', payload: { message: 'Audit completed!', status: 'completed', id: jobId } }, { httpSend: true })
                }

            } catch (error) {
                console.error('Phase 2 error:', error)
                await supabaseClient.from('jobs').update({
                    status: 'failed',
                    status_message: `Analysis failed: ${(error as Error).message.substring(0, 100)}`
                }).eq('id', jobId)
                if (statusChannel) {
                    await statusChannel.send({
                        type: 'broadcast',
                        event: 'status_update',
                        payload: { message: `Analysis failed: ${(error as Error).message}`, status: 'failed', id: jobId }
                    }, { httpSend: true }).catch((broadcastError: unknown) => {
                        console.error('Failed to broadcast analysis failure:', broadcastError)
                    })
                }
            } finally {
                concurrencyLimiter.release()
                if (statusChannel) await supabaseClient.removeChannel(statusChannel)
            }
        })()

        // Use waitUntil to keep function alive for Phase 2
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
            // @ts-ignore
            EdgeRuntime.waitUntil(processPhase2)
        } else {
            processPhase2.catch(e => console.error('Phase 2 failure:', e))
        }

        return new Response(JSON.stringify({
            success: true,
            job_id: jobId,
            phase: 'analyzing',
            message: 'Analysis phase started.'
        }), { headers: corsHeaders })

    } catch (error) {
        console.error('Workflow error:', error)
        if (jobIdForFailure && supabaseForFailure) {
            await supabaseForFailure.from('jobs').update({
                status: 'failed',
                status_message: `Workflow failed: ${(error as Error).message.substring(0, 140)}`
            }).eq('id', jobIdForFailure).catch((statusError: unknown) => {
                console.error('Failed to persist workflow failure:', statusError)
            })
        }
        return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 200, headers: corsHeaders })
    }
})
