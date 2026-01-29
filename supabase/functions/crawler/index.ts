// Crawl Website - Dedicated crawling function with extended timeout
// Phase 1 of two-phase audit architecture

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// --- CONSOLIDATED HELPERS (For manual copy-pasting) ---
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-3-large',
            input: text.replace(/\n/g, ' '),
            dimensions: 1536
        })
    })
    if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI Embedding Error: ${error}`)
    }
    const data = await response.json()
    return data.data[0].embedding
}

function chunkText(text: string, maxChars: number = 1000): string[] {
    if (!text || text.length === 0) return []
    const chunks: string[] = []
    let currentChunk = ''
    const paragraphs = text.split(/\n\s*\n/)
    for (const paragraph of paragraphs) {
        if ((currentChunk.length + paragraph.length) > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim()); currentChunk = ''
        }
        if (paragraph.length > maxChars) {
            const sentences = paragraph.match(/[^.!?]+[.!?]+|\s+/g) || [paragraph]
            for (const sentence of sentences) {
                if ((currentChunk.length + sentence.length) > maxChars && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim()); currentChunk = ''
                }
                currentChunk += sentence
            }
        } else {
            currentChunk += paragraph + '\n\n'
        }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim())
    return chunks
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

const LEGAL_PATHS = [
    // Legal pages
    '/impressum', '/imprint', '/legal-notice', '/legal', '/legal-info',
    '/datenschutz', '/privacy', '/privacy-policy', '/data-protection',
    '/agb', '/terms', '/terms-of-service', '/terms-and-conditions', '/conditions',
    '/widerruf', '/withdrawal', '/returns', '/refund', '/retour',
    '/colofon', '/algemene-voorwaarden', '/privacybeleid', '/privacyverklaring',
    '/cookies', '/disclaimer',
    // Contact and company info pages (PRIORITY for company extraction)
    '/kontakt', '/contact', '/contact-us', '/contactus', '/kontaktieren',
    '/about', '/about-us', '/uber-uns', '/ueber-uns', '/over-ons',
    '/unternehmen', '/company', '/our-company', '/our-team', '/team',
    '/wir', '/who-we-are', '/wie-zijn-wij',
    // Footer links often have company info
    '/impressum-kontakt', '/legal-contact', '/company-info',
    '/anfahrt', '/standort', '/location', '/locations'
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
                body: JSON.stringify({ url: targetUrl, limit: 50, scrapeOptions: { formats: ['markdown', 'html'] } })
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
    // Page type detection
    const legalTerms = ['impressum', 'imprint', 'legal-notice', 'agb', 'terms', 'privacy', 'gdpr', 'dsgvo', 'colofon', 'datenschutz', 'widerruf']
    const contactTerms = ['kontakt', 'contact', 'about', 'uber-uns', 'ueber-uns', 'over-ons', 'unternehmen', 'company', 'team', 'who-we-are']

    const pages = data.map((item: any) => {
        const url = (item.metadata?.sourceURL || item.url || '').toLowerCase()
        const isLegal = legalTerms.some(term => url.includes(term))
        const isContact = contactTerms.some(term => url.includes(term))
        const markdown = item.markdown || ''
        // Legal and contact pages get more content allowance
        const contentLimit = isLegal ? 30000 : isContact ? 25000 : 10000

        return {
            title: item.metadata?.title || item.title || 'Page',
            url: item.metadata?.sourceURL || item.url || '',
            markdown: markdown.substring(0, contentLimit),
            pageType: isLegal ? 'legal' : isContact ? 'contact' : 'general'
        }
    })

    // Extract contact info from ALL pages
    let email = '', phone = '', address = '', vatId = '', regNumber = '', companyName = ''
    for (const item of data) {
        const content = item.markdown || ''
        if (!email) { const m = content.match(/[\w.-]+@[\w.-]+\.\w+/); if (m) email = m[0] }
        if (!phone) { const m = content.match(/(\+49|0049|0|\+31|\+32|\+43)[\s\d\-\/]{8,}/); if (m) phone = m[0].trim() }
        // VAT ID patterns (German, Dutch, Belgian, Austrian)
        if (!vatId) {
            const m = content.match(/(?:USt-?Id(?:Nr)?|UID|VAT|BTW(?:-?nummer)?|BTW-id)[:\s.]*([A-Z]{2}\s?\d{9,11}[A-Z]?\d?)/i)
            if (m) vatId = m[1].replace(/\s/g, '')
        }
        // Registration number (Handelsregister, KvK, Belgian)
        if (!regNumber) {
            const m = content.match(/(?:HRB?|Handelsregister|KvK(?:-nummer)?|Kamer van Koophandel|Rechtbank|Ondernemingsnummer)[:\s]*(\d{4,10})/i)
            if (m) regNumber = m[1]
        }
        // Address pattern (German 5 digits, Dutch 4 digits + 2 letters)
        if (!address) {
            // Dutch format: 1234 AB City or German: 12345 City
            const m = content.match(/(\d{4,5}\s*[A-Z]{0,2}\s+[A-Za-zäöüßÄÖÜ\s-]+(?:straße|strasse|str\.|weg|platz|laan|straat|singel|gracht)?[^,\n]{0,50})/i)
            if (m) address = m[1].trim()
        }
        // Company name patterns (German + Dutch legal forms)
        if (!companyName) {
            const m = content.match(/([A-Za-zäöüßÄÖÜ\s&.-]+(?:GmbH|AG|UG|KG|OHG|eG|BV|NV|VOF|CV|Ltd\.?|Inc\.?|LLC|Holding))/i)
            if (m) companyName = m[1].trim()
        }
    }

    // TRANSLATION STRUCTURE ANALYSIS
    const urls = pages.map(p => p.url.toLowerCase())
    const allContent = pages.map(p => p.markdown).join(' ').toLowerCase()

    // Check for proper language subfolders
    const hasLanguageSubfolders = urls.some(u =>
        /\/(de|en|nl|fr|es|it|pl|at|ch)\//.test(u) ||
        /\/(de-de|en-gb|en-us|de-at|de-ch|nl-nl|nl-be)\//.test(u)
    )

    // Check for translation widgets
    const hasTranslationWidget =
        allContent.includes('gtranslate') ||
        allContent.includes('google translate') ||
        allContent.includes('weglot') ||
        allContent.includes('translated by google') ||
        allContent.includes('translate.google')

    // Check for language switcher indicators
    const hasLanguageSwitcher =
        allContent.includes('language switcher') ||
        allContent.includes('select language') ||
        allContent.includes('sprache wählen') ||
        allContent.includes('kies taal') ||
        /class="[^"]*lang[^"]*switch/i.test(allContent) ||
        /id="[^"]*language/i.test(allContent)

    const translationStructure = {
        hasProperLocalization: hasLanguageSubfolders,
        suspectedMachineTranslation: hasTranslationWidget || (hasLanguageSwitcher && !hasLanguageSubfolders),
        hasLanguageSwitcher,
        hasTranslationWidget,
        analysis: hasTranslationWidget
            ? 'DETECTED: Translation widget (likely Google Translate or similar). Site may use machine translation.'
            : hasLanguageSwitcher && !hasLanguageSubfolders
                ? 'WARNING: Language switcher found but no language-specific URLs (/de/, /en/). Possibly using client-side translation.'
                : hasLanguageSubfolders
                    ? 'GOOD: Proper language subfolders detected. Site appears to have professional localization.'
                    : 'UNKNOWN: No language structure detected. Single-language site or unable to determine.'
    }

    return {
        pages,
        contact: { email, phone, address },
        company: { name: companyName, vatId, registrationNumber: regNumber },
        crawledAt: new Date().toISOString(),
        totalPages: pages.length,
        legalPagesFound: pages.filter((p: any) => p.pageType === 'legal').length,
        contactPagesFound: pages.filter((p: any) => p.pageType === 'contact').length,
        translationStructure
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        console.log('[Crawler] Start processing request...')
        const body = await req.json() as CrawlInput
        const { job_id, url, user_id, force_recrawl } = body

        console.log(`[Crawler] Job: ${job_id}, URL: ${url}, Force: ${force_recrawl}`)

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY') || ''
        const openaiKey = Deno.env.get('OPENAI_API_KEY') || ''

        console.log(`[Crawler] Env Check - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}, Firecrawl: ${!!firecrawlKey}, OpenAI: ${!!openaiKey}`)

        if (!openaiKey) {
            console.error('[Crawler] CRITICAL: OPENAI_API_KEY is missing. RAG will fail.')
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey)
        const updateStatus = async (msg: string) => {
            console.log(`[Crawler Status Update] ${msg}`)
            await supabaseClient.from('jobs').update({ status_message: msg, crawl_status: 'crawling' }).eq('id', job_id)
        }

        let crawlData: any = null

        // 1. DATA REUSE STRATEGY
        if (!force_recrawl) {
            console.log('[Crawler] Checking for existing data...')
            const { data: existingJob, error: checkError } = await supabaseClient
                .from('jobs')
                .select('id, raw_data')
                .eq('url', url) // Match exact URL
                .eq('crawl_status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (checkError) console.error('[Crawler] Reuse check error:', checkError)

            if (existingJob && existingJob.raw_data) {
                console.log(`[Crawler] Found existing job: ${existingJob.id}`)
                const { count } = await supabaseClient
                    .from('document_chunks')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', existingJob.id)

                console.log(`[Crawler] Existing chunks count: ${count}`)

                if (count && count > 0) {
                    await updateStatus('Reuse Strategy: Found existing knowledge base. Linking...')
                    crawlData = existingJob.raw_data

                    // Link old chunks to new job_id (Super fast, keeps RAG working)
                    const { data: oldChunks } = await supabaseClient
                        .from('document_chunks')
                        .select('url, content, metadata, embedding')
                        .eq('job_id', existingJob.id)

                    if (oldChunks && oldChunks.length > 0) {
                        const newChunks = oldChunks.map((c: any) => ({ ...c, job_id }))
                        const { error: copyError } = await supabaseClient.from('document_chunks').insert(newChunks)
                        if (copyError) console.error('[Crawler] Chunk copy error:', copyError)
                        else console.log(`[Crawler] Successfully copied ${newChunks.length} chunks`)
                    }
                }
            } else {
                console.log('[Crawler] No reusable data found.')
            }
        }

        // 2. FRESH CRAWL & INGESTION (Only if no reuse)
        if (!crawlData) {
            await updateStatus('Phase 1: Deep Crawl started...')
            crawlData = await executeCrawl(url, firecrawlKey, updateStatus)
            console.log(`[Crawler] Crawl complete. Raw pages: ${crawlData?.pages?.length || 0}`)

            await updateStatus('RAG: Building knowledge base for vector search...')
            const allPages = crawlData.pages || []

            let chunkCount = 0
            for (const page of allPages) {
                console.log(`[Crawler] Processing page: ${page.url}`)
                const chunks = chunkText(page.markdown || '', 1000)
                if (chunks.length === 0) continue

                const inserts = []
                for (const chunk of chunks) {
                    try {
                        const embedding = await generateEmbedding(chunk, openaiKey)
                        inserts.push({
                            job_id: job_id,
                            url: page.url,
                            content: chunk,
                            metadata: { title: page.title, pageType: page.pageType },
                            embedding: embedding
                        })
                    } catch (e) {
                        console.error(`[Crawler] Error embedding chunk for ${page.url}:`, e)
                    }
                }

                if (inserts.length > 0) {
                    const { error } = await supabaseClient.from('document_chunks').insert(inserts)
                    if (error) console.error('[Crawler] Supabase Ingestion Error:', error)
                    else {
                        console.log(`[Crawler] Ingested ${inserts.length} chunks for ${page.url}`)
                        chunkCount += inserts.length
                    }
                }
            }
            await updateStatus(`RAG: Ingested ${chunkCount} chunks.`)
        }

        // 3. FINALIZE PHASE 1
        console.log('[Crawler] Finalizing Phase 1...')
        const { error: updateError } = await supabaseClient.from('jobs').update({
            raw_data: crawlData,
            crawl_status: 'completed',
            status_message: 'Crawl finished. Analysis starting...'
        }).eq('id', job_id)

        if (updateError) console.error('[Crawler] Failed to update job status:', updateError)

        // TRIGGER PHASE 2
        console.log('[Crawler] Triggering Phase 2...')
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-workflow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id, input_as_text: url, user_id, is_callback: true })
        }).catch(e => console.error('Callback failed:', e))

        console.log('[Crawler] Done.')
        return new Response(JSON.stringify({ success: true, message: 'Phase 1 complete.' }), { headers: corsHeaders })
    } catch (error) {
        console.error('[Crawler] Fatal Error:', error)
        return new Response(JSON.stringify({ success: false, error: (error as Error).message }), { status: 500, headers: corsHeaders })
    }
})
