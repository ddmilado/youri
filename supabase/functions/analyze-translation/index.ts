
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

interface RequestBody {
    url: string
    user_id: string
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { url, user_id } = await req.json() as RequestBody

        if (!url) throw new Error('URL is required')

        // Initialize Clients
        const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY') || Deno.env.get('VITE_FIRECRAWL_API_KEY')
        const openaiKey = Deno.env.get('OPENAI_API_KEY')

        if (!firecrawlKey) throw new Error('FIRECRAWL_API_KEY is missing')
        if (!openaiKey) throw new Error('OPENAI_API_KEY is missing')

        // --- STEP 1: Map the Website ---
        console.log(`[Analysis] Mapping ${url}...`)
        const mapResponse = await fetch('https://api.firecrawl.dev/v2/map', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                search: "", // map everything
                ignoreQueryParameters: true,
                limit: 5000
            })
        })

        if (!mapResponse.ok) {
            throw new Error(`Firecrawl Map failed: ${await mapResponse.text()}`)
        }

        const mapData = await mapResponse.json()
        const links = mapData.links || mapData.data || [] // Handle v2 response format variations
        const urls = links.map((l: any) => typeof l === 'string' ? l : l.url) as string[]

        console.log(`[Analysis] Found ${urls.length} links using Firecrawl Map`)

        // --- STEP 2: Detect Language Structure ---
        console.log(`[Analysis] Detecting language structure...`)

        // check for subdirectories and subdomains in mapped URLs
        const commonLangCodes = ['/en/', '/fr/', '/de/', '/es/', '/it/', '/nl/', '/pt/', '/ru/', '/zh/', '/ja/', '/de-de/', '/de-ch/', '/de-at/']
        const foundSubdirs = commonLangCodes.filter(code => urls.some(u => u.includes(code)))

        // Detect subdomains like de.example.com
        const hasGermanSubdomain = urls.some(u => {
            try {
                const hostname = new URL(u).hostname
                return hostname.startsWith('de.') || hostname.includes('.de.')
            } catch { return false }
        })

        let languageStructure = 'unknown'
        let isClientSide = false

        if (foundSubdirs.length > 0 || hasGermanSubdomain) {
            languageStructure = 'subdirectories'
            console.log(`[Analysis] Found language signals: ${foundSubdirs.join(', ')}${hasGermanSubdomain ? ' (German Subdomain Detected)' : ''}`)
        } else {
            // Check for 404s on common language paths to confirm
            const testPaths = ['/fr', '/de', '/es']
            let failedCount = 0

            // Normalize URL (remove trailing slash)
            const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url

            for (const path of testPaths) {
                try {
                    const res = await fetch(`${baseUrl}${path}`, { method: 'HEAD' })
                    if (res.status === 404) failedCount++
                } catch (e) {
                    failedCount++ // Assume failure means not found or accessible
                }
            }

            if (failedCount === testPaths.length) {
                isClientSide = true
                languageStructure = 'client-side' // Likely GTranslate or similar if no subdirs exist
                console.log(`[Analysis] Confirmed client-side translation (404 on language paths)`)
            }
        }

        // --- STEP 3: Select Top Pages & Scrape ---
        // Naive Importance Heuristic: Home < About < Contact < Pricing < Products
        // Shortest URLs are usually top-level pages
        const sortedUrls = urls.sort((a, b) => a.length - b.length)

        // Filter unique and useful pages
        // Filter unique and useful pages, prioritizing legal pages
        const keyTerms = [
            'impressum', 'legal-notice', 'disclosure',
            'agb', 'terms', 'condition', 'tos',
            'datenschutz', 'privacy', 'gdpr', 'dsgvo',
            'widerruf', 'withdrawal', 'return', 'refund',
            'shipping', 'versand',
            'about', 'contact', 'pricing', 'product', 'service', 'feature', 'team', 'jobs', 'career'
        ]

        const importantPages = new Set<string>()
        if (urls.length > 0) importantPages.add(sortedUrls[0]) // Home

        // Find matches for terms
        for (const term of keyTerms) {
            const match = sortedUrls.find(u => u.toLowerCase().includes(term))
            if (match && !importantPages.has(match)) {
                importantPages.add(match)
            }
            if (importantPages.size >= 10) break
        }

        // Fill up to 10 with shortest remaining
        for (const u of sortedUrls) {
            if (importantPages.size >= 10) break
            importantPages.add(u)
        }

        const pagesToScrape = Array.from(importantPages)
        console.log(`[Analysis] Selected pages to scrape:`, pagesToScrape)

        // Scrape content (using Batch Scrape if available, or parallel requests)
        // Firecrawl /v1/batch/scrape is powerful, or just individual calls. 
        // Let's use individual calls with Promise.all for simplicity and control.

        const scrapePromises = pagesToScrape.map(async (pageUrl) => {
            try {
                const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: pageUrl, formats: ['markdown'] })
                })
                const data = await res.json()
                return { url: pageUrl, content: data.data?.markdown || "", success: data.success }
            } catch (e) {
                return { url: pageUrl, content: "", success: false, error: String(e) }
            }
        })

        const scrapedPages = await Promise.all(scrapePromises)

        // --- STEP 4: Translation Audit (AI) ---
        // If client-side, we assume there are no distinct language pages to compare.
        // We will audit the *English* (or source) content for "Translatability" issues.
        // OR checks for "machine translation style" if the source itself was MT'd (unlikely for main site).
        // User asked: "find inconsistencies... lacking context"

        const auditResults = []

        // We will only audit the Home page and maybe one other to save tokens/time
        const pagesToAudit = scrapedPages.filter(p => p.success && p.content.length > 100).slice(0, 2)

        for (const page of pagesToAudit) {
            const prompt = `You are a Localization and Translation Expert.
            The user suspects this website uses automatic client-side translation (like GTranslate) without review.
            
            Your task:
            1. Analyze the following headers and key paragraph text from the website.
            2. Identify 3 specific text segments that would likely result in a **bad or confusing translation** if passed through a generic Machine Translation engine (like Google Translate) without context.
            3. Explain WHY (e.g., ambiguity, idiom, spacing, cultural nuance).
            4. If the text *already* looks like bad machine translation (e.g. awkward phrasing in English), point that out.
            
            Content to analyze:
            ${page.content.slice(0, 2000)}... (truncated)

            Output JSON Format:
            {
                "issues": [
                    {
                        "original_text": "text segment",
                        "predicted_error": "How it might be mistranslated",
                        "reason": "Why (e.g. ambiguity)",
                        "correction": "Better phrasing"
                    }
                ]
            }`

            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // fast and good enough
                    messages: [{ role: 'system', content: "You are an expert auditor." }, { role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            })

            const aiData = await aiRes.json()
            const content = aiData.choices[0]?.message?.content
            if (content) {
                try {
                    const parsed = JSON.parse(content)
                    auditResults.push({ page: page.url, ...parsed })
                } catch (e) {
                    console.error('Error parsing AI audit', e)
                }
            }
        }

        // --- STEP 5: Compile Report ---
        const report = {
            url,
            is_client_side_translation: isClientSide,
            detected_structure: languageStructure,
            mapped_urls_count: urls.length,
            scraped_pages_count: scrapedPages.length,
            audit_findings: auditResults
        }

        return new Response(JSON.stringify(report), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Error in analyze-translation:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
