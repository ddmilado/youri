// Crawl Website - Dedicated crawling function with extended timeout
// Phase 1 of two-phase audit architecture

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

const LEGAL_PATHS = [
    '/impressum', '/imprint', '/legal-notice', '/legal', '/legal-info',
    '/datenschutz', '/privacy', '/privacy-policy', '/data-protection',
    '/agb', '/terms', '/terms-of-service', '/terms-and-conditions', '/conditions',
    '/widerruf', '/withdrawal', '/returns', '/refund', '/retour',
    '/colofon', '/algemene-voorwaarden', '/privacybeleid', '/privacyverklaring',
    '/kontakt', '/contact', '/about', '/uber-uns', '/about-us',
    '/cookies', '/disclaimer'
]

interface CrawlInput {
    job_id: string
    url: string
    user_id: string
    force_recrawl?: boolean
}

async function scrapeSinglePage(url: string, apiKey: string): Promise<any | null> {
    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                timeout: 10000
            })
        })
        if (!response.ok) return null
        const data = await response.json()
        if (data.success && data.data) {
            return {
                url,
                title: data.data.metadata?.title || 'Page',
                markdown: data.data.markdown || '',
                pageType: 'legal'
            }
        }
        return null
    } catch (e) {
        console.log(`Failed to scrape ${url}:`, e)
        return null
    }
}

async function fetchLegalPagesDirect(baseUrl: string, apiKey: string, updateStatus: (msg: string) => Promise<void>): Promise<any[]> {
    await updateStatus('Fetching legal pages directly...')
    let base = baseUrl.replace(/\/$/, '')
    if (!base.startsWith('http')) base = 'https://' + base
    const batchSize = 5
    const results: any[] = []
    for (let i = 0; i < LEGAL_PATHS.length; i += batchSize) {
        const batch = LEGAL_PATHS.slice(i, i + batchSize)
        const batchResults = await Promise.allSettled(batch.map(path => scrapeSinglePage(base + path, apiKey)))
        for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) results.push(result.value)
        }
        await updateStatus(`Found ${results.length} legal pages so far...`)
    }
    return results
}

async function executeCrawl(targetUrl: string, apiKey: string, updateStatus: (msg: string) => Promise<void>): Promise<any> {
    const [crawlResult, legalPages] = await Promise.all([
        (async () => {
            await updateStatus('Starting website crawl...')
            const startResponse = await fetch('https://api.firecrawl.dev/v2/crawl', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl, limit: 20, scrapeOptions: { formats: ['markdown', 'html'] } })
            })
            if (!startResponse.ok) return []
            const startData = await startResponse.json()
            if (startData.status === 'completed' && startData.data) return startData.data
            const crawlId = startData.id
            if (!crawlId) return []
            const maxTime = 45000
            const startTime = Date.now()
            let partialData: any[] = []
            while (Date.now() - startTime < maxTime) {
                await new Promise(r => setTimeout(r, 4000))
                const statusRes = await fetch(`https://api.firecrawl.dev/v2/crawl/${crawlId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })
                if (statusRes.ok) {
                    const sData = await statusRes.json()
                    if (sData.status === 'completed') return sData.data
                    if (sData.status === 'failed') break
                    if (sData.data && sData.data.length > 0) partialData = sData.data
                    await updateStatus(`Crawling... ${sData.completed || 0}/${sData.total || 0} pages`)
                }
            }
            return partialData
        })(),
        fetchLegalPagesDirect(targetUrl, apiKey, updateStatus)
    ])

    const allPages = [...(crawlResult || [])]
    const existingUrls = new Set(allPages.map((p: any) => p.metadata?.sourceURL || p.url))
    for (const legalPage of legalPages) {
        if (!existingUrls.has(legalPage.url)) {
            allPages.push({ metadata: { sourceURL: legalPage.url, title: legalPage.title }, markdown: legalPage.markdown })
        }
    }
    return formatCrawlResults(allPages)
}

function formatCrawlResults(data: any[]): any {
    const legalTerms = ['impressum', 'legal-notice', 'disclosure', 'agb', 'terms', 'privacy', 'gdpr', 'dsgvo', 'colofon', 'kontakt']
    const pages = data.map((item: any) => {
        const url = (item.metadata?.sourceURL || item.url || '').toLowerCase()
        const isLegal = legalTerms.some(term => url.includes(term))
        const markdown = item.markdown || ''
        const contentLimit = isLegal ? 25000 : 10000
        return {
            title: item.metadata?.title || item.title || 'Page',
            url: item.metadata?.sourceURL || item.url || '',
            markdown: markdown.substring(0, contentLimit),
            pageType: isLegal ? 'legal' : 'general'
        }
    })
    let email = '', phone = ''
    for (const item of data) {
        const content = item.markdown || ''
        if (!email) { const m = content.match(/[\w.-]+@[\w.-]+\.\w+/); if (m) email = m[0] }
        if (!phone) { const m = content.match(/(\+49|0049|0|\+31|\+32|\+43)[\s\d\-\/]{8,}/); if (m) phone = m[0].trim() }
    }
    return { pages, contact: { email, phone }, crawledAt: new Date().toISOString(), totalPages: pages.length }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const body = await req.json() as CrawlInput
        const { job_id, url, user_id, force_recrawl } = body
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        const updateStatus = async (msg: string) => {
            await supabaseClient.from('jobs').update({ status_message: msg, crawl_status: 'crawling' }).eq('id', job_id)
        }

        await updateStatus('Phase 1: Deep Crawl started...')
        const crawlData = await executeCrawl(url, Deno.env.get('FIRECRAWL_API_KEY') || '', updateStatus)

        await supabaseClient.from('jobs').update({
            raw_data: crawlData,
            crawl_status: 'completed',
            status_message: 'Crawl finished. Re-triggering analysis...'
        }).eq('id', job_id)

        // PHASE 2 CALL BACK
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-workflow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id, input_as_text: url, user_id, is_callback: true })
        }).catch(e => console.error('Callback failed:', e))

        return new Response(JSON.stringify({ success: true, message: 'Phase 1 complete. Phase 2 triggered.' }), { headers: corsHeaders })
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 500, headers: corsHeaders })
    }
})
