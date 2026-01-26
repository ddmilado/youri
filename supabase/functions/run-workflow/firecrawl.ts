// Firecrawl API utilities for website crawling and structure analysis

export async function executeContextGatheringAgent(
    targetUrl: string,
    apiKey: string,
    updateStatus: (msg: string) => Promise<void>
): Promise<any> {
    console.log(`Starting Context Gathering for: "${targetUrl}"`)

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
                limit: 10, // Reverted to 10 to prevent wall_clock timeouts (20 pages * 15k chars is too heavy)
                scrapeOptions: { formats: ['markdown', 'html'] }
            })
        })

        if (!startResponse.ok) throw new Error(`Failed to start crawl: ${await startResponse.text()}`)

        const startData = await startResponse.json()
        if (startData.status === 'completed' && startData.data) return startData.data

        const jobId = startData.id
        if (!jobId) throw new Error('No Job ID received from Firecrawl')

        // TIMEOUT SAFETY: Aggressively reduced to 15s.
        // We need maximum time for the 11-agent parallel swarm.
        const maxTime = 15000
        const startTime = Date.now()
        let partialData: any[] = []
        while (Date.now() - startTime < maxTime) {
            await new Promise(r => setTimeout(r, 3000))
            const statusRes = await fetch(`https://api.firecrawl.dev/v2/crawl/${jobId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            if (statusRes.ok) {
                const sData = await statusRes.json()
                if (sData.status === 'completed') return sData.data
                if (sData.status === 'failed') throw new Error(sData.error || 'Crawl failed')
                if (sData.data && sData.data.length > 0) {
                    partialData = sData.data
                }
                await updateStatus(`Crawling... ${sData.completed || 0}/${sData.total || 0} pages`)
            }
        }
        if (partialData.length > 0) {
            console.log(`Crawl timeout but returning ${partialData.length} partial pages`)
            await updateStatus(`Timeout - proceeding with ${partialData.length} pages`)
            return partialData
        }
        throw new Error('Crawl timed out with no data')
    })()

    // 2. Start Map & Structure Analysis
    const structurePromise = (async () => {
        await updateStatus('Analyzing URL structure for translation patterns...')
        try {
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
                const links = mapData.links || mapData.data || []
                urls = links.map((l: any) => typeof l === 'string' ? l : l.url).filter(Boolean) as string[]
            }

            const commonLangCodes = ['/en/', '/fr/', '/de/', '/es/', '/it/', '/nl/', '/pt/', '/ru/', '/zh/', '/ja/', '/de-de/', '/de-ch/', '/de-at/']
            const foundSubdirs = commonLangCodes.filter(code => urls.some(u => u.includes(code)))

            const hasGermanSubdomain = urls.some(u => {
                try {
                    const hostname = new URL(u).hostname
                    return hostname.startsWith('de.') || hostname.includes('.de.')
                } catch { return false }
            })

            let structureNote = `Total Mapped URLs: ${urls.length}\n`

            if (foundSubdirs.length > 0 || hasGermanSubdomain) {
                structureNote += `Detected Language Signals: ${foundSubdirs.join(', ')}${hasGermanSubdomain ? ' (German Subdomain Detected)' : ''}\n`
                structureNote += `Conclusion: Server-Side Translation (likely robust).`
            } else {
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
                    structureNote += `Conclusion: Client-Side Translation or Single Language Site.\n`
                } else {
                    structureNote += `Detected Language Subdirectories: None, but some language paths exist.`
                }
            }
            return structureNote
        } catch (err) {
            console.error('Structure analysis failed:', err)
            return "Structure analysis failed."
        }
    })()

    let crawlData: any[] = []
    let structureData = ""
    let mappedUrls: string[] = []

    try {
        const [cData, sNote] = await Promise.all([crawlPromise, structurePromise])
        crawlData = cData
        structureData = sNote
        // Extract links from structureData context if possible, or just use the note
    } catch (e) {
        console.error('Error in context gathering:', e)
        await updateStatus('Partial context gathering failure. Proceeding...')
    }

    // NEW: Targeted Scrape for missing legal pages
    try {
        const discoveredLegalUrls = (structureData.match(/https?:\/\/[^\s\n]+/g) || [])
            .filter(u => {
                const url = u.toLowerCase()
                const legalTerms = [
                    'impressum', 'legal-notice', 'disclosure', 'agb', 'terms', 'privacy',
                    'datenschutz', 'widerruf', 'shipping', 'colofon', 'privacybeleid'
                ]
                return legalTerms.some(term => url.includes(term))
            })

        const capturedUrls = new Set(crawlData.map(p => (p.metadata?.sourceURL || '').toLowerCase()))
        const missingLegals = [...new Set(discoveredLegalUrls)].filter(u => !capturedUrls.has(u.toLowerCase())).slice(0, 3)

        if (missingLegals.length > 0) {
            await updateStatus(`Found ${missingLegals.length} deep legal pages. Scraping...`)

            // Execute scrapes in parallel
            await Promise.all(missingLegals.map(async (url) => {
                try {
                    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url, formats: ['markdown'] })
                    })
                    if (res.ok) {
                        const data = await res.json()
                        if (data.data) crawlData.push(data.data)
                    }
                } catch (e) { console.error(`Failed to scrape missing legal: ${url}`, e) }
            }))
        }
    } catch (err) {
        console.warn('Targeted legal scrape failed:', err)
    }

    // Analyze HTML for translation widgets
    try {
        const homePage = crawlData.find((p: any) => {
            const u = (p.metadata?.sourceURL || '').toLowerCase()
            return u === targetUrl.toLowerCase() || u === targetUrl.toLowerCase() + '/'
        }) || crawlData[0]

        if (homePage && homePage.html) {
            const html = homePage.html.toLowerCase()
            const signatures = [
                'gtranslate', 'goog-te-combo', 'google_translate_element',
                'goog-te-menu-frame', 'translate.google.com', 'gtranslate.io',
                'wp-google-translate', 'translate="no"', 'class="notranslate"'
            ]
            const foundSignature = signatures.find(sig => html.includes(sig))

            if (foundSignature) {
                const potentialLangs: string[] = []
                if (html.includes('lang="de"')) potentialLangs.push('German')
                if (html.includes('lang="fr"')) potentialLangs.push('French')
                const noSubdirsDetected = structureData.includes('Detected Language Subdirectories: None')

                if (noSubdirsDetected) {
                    structureData = `CRITICAL: Client-Side Translation Widget CONFIRMED.\n`
                    structureData += `Evidence: Found '${foundSignature}' in HTML.\n`
                    structureData += `Conclusion: Machine Translation detected.\n`
                    if (potentialLangs.length > 0) {
                        structureData += `Widget Languages: ${potentialLangs.join(', ')}\n`
                    }
                } else {
                    structureData += `\nNOTE: Widget ('${foundSignature}') found, but subdirectories exist. Hybrid approach.`
                }
            } else {
                if (structureData.includes('Detected Language Subdirectories: None')) {
                    structureData += `\nHTML Check: No translation widgets found.\n`
                    structureData += `Final Conclusion: Mono-Lingual Site.`
                } else {
                    structureData += `\nHTML Check: Clean (No widgets detected).`
                }
            }
        }
    } catch (err) {
        console.warn('Widget HTML analysis error:', err)
    }

    const formatted = formatCrawlResults(crawlData)
    return {
        translationStructure: structureData,
        ...formatted
    }
}

export function formatCrawlResults(data: any[]): any {
    if (!Array.isArray(data)) {
        console.warn('Crawl data is not an array:', typeof data)
        return { pages: [], contact: {}, company: {} }
    }

    const legalTerms = [
        'impressum', 'legal-notice', 'disclosure', 'agb', 'terms', 'condition', 'tos',
        'datenschutz', 'privacy', 'gdpr', 'dsgvo', 'widerruf', 'withdrawal', 'return', 'refund',
        'shipping', 'versand', 'imprint', 'legal-notice', 'legal-info', 'company-information',
        'terms-and-conditions', 'terms-of-service', 'privacy-policy', 'data-protection',
        'colofon', 'algemene-voorwaarden', 'privacybeleid', 'privacyverklaring', 'leveringsvoorwaarden'
    ]

    const prioritizedData = [...data].sort((a, b) => {
        const urlA = (a.metadata?.sourceURL || '').toLowerCase()
        const urlB = (b.metadata?.sourceURL || '').toLowerCase()
        const isLegalA = legalTerms.some(term => urlA.includes(term))
        const isLegalB = legalTerms.some(term => urlB.includes(term))
        if (isLegalA && !isLegalB) return -1
        if (!isLegalA && isLegalB) return 1
        return 0
    })

    const pages = prioritizedData.map((item: any) => {
        const url = (item.metadata?.sourceURL || '').toLowerCase()
        const isLegal = legalTerms.some(term => url.includes(term))
        return {
            title: item.metadata?.title || 'Page',
            url: item.metadata?.sourceURL || '',
            markdown: (item.markdown || '').substring(0, 15000),
            pageType: isLegal ? 'legal' : 'general'
        }
    })

    let email = ''
    let phone = ''

    for (const item of data) {
        const content = item.markdown || ''
        if (!email) {
            const emailMatch = content.match(/[\w.-]+@[\w.-]+\.\w+/)
            if (emailMatch) email = emailMatch[0]
        }
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
