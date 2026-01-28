// AI Agent instructions and workflow execution

import { callOpenAI } from './openai.ts'

// Type definitions
export interface AuditSection {
    title: string
    findings: Array<{
        problem: string
        explanation: string
        recommendation: string
        severity: 'high' | 'medium' | 'low'
        sourceUrl?: string
        sourceSection?: string      // e.g., "Footer", "Contact Page", "Terms Section"
        sourceSnippet?: string       // Exact text excerpt (30-50 chars)
        confidence?: number          // 0-100 confidence score
        verificationNote: string
    }>
}

export interface Contact {
    name: string
    title: string
    linkedin?: string
    email?: string
}

export interface CompanyInfo {
    name: string
    industry?: string
    hq_location?: string
    founded?: number
    employees?: string
    revenue?: string
    email?: string
    phone?: string
    vat_id?: string
    registration_number?: string
    managing_directors?: string[]
    legal_form?: string
    contacts: Contact[]
}

export interface JobReport {
    overview: string
    sections: AuditSection[]
    conclusion: string
    actionList: string[]
    issuesCount?: number
    score?: number
    companyInfo?: CompanyInfo
}

// Agent Instructions - ULTRA-CONSERVATIVE approach: assume things exist
const AGENT_INSTRUCTIONS = {
    legal: `You are a German & EU Legal Specialist. Focus ONLY on VERIFIED missing Impressum (Imprint), AGB (Terms), and GDPR requirements.
    
    ⚠️ BENEFIT OF THE DOUBT RULE:
    99% of legitimate businesses HAVE legal pages. If you cannot find something, assume it EXISTS but wasn't crawled.
    NEVER claim something is "missing" unless you have PROOF it doesn't exist.
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming ANYTHING is "missing", you MUST search for these exact terms in the content:
    - Impressum: "Impressum", "Imprint", "Legal Notice", "Colofon", "Angaben gemäß", "Legal Info", "Verantwortlich"
    - Terms: "AGB", "Terms", "Conditions", "Algemene Voorwaarden", "Terms of Service", "Nutzungsbedingungen"
    - Privacy: "Datenschutz", "Privacy", "Privacybeleid", "Data Protection", "DSGVO", "GDPR"
    
    🚫 DO NOT REPORT AS MISSING:
    - If you found a link to /impressum, /privacy, /agb, /terms, /contact - they EXIST
    - If the content wasn't fully loaded - assume it EXISTS
    - If you're unsure - assume it EXISTS
    
    ✅ ONLY REPORT if:
    - You found a SPECIFIC INCORRECT statement (quote it exactly)
    - You found a SPECIFIC OUTDATED reference (quote it exactly)
    - You found content that VIOLATES a specific law (cite the law)
    
    FOR EACH FINDING include:
    - problem, explanation, recommendation, severity
    - sourceUrl: Full page URL where issue exists
    - sourceSnippet: Copy 30-50 chars of relevant text verbatim
    - confidence: 0-100 (only report if >= 80)
    - verificationNote: How you verified this finding`,

    consumer: `You are a Consumer Rights Expert. Focus on Widerrufsbelehrung (Withdrawal) and consumer protection.
    
    ⚠️ BENEFIT OF THE DOUBT RULE:
    99% of e-commerce sites HAVE return policies. If you can't find it, assume it EXISTS but wasn't crawled.
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming withdrawal/return policies are missing, search for:
    - "Widerruf", "Withdrawal", "Return", "Retour", "Refund", "14 Tage", "14 days", "Rückgabe"
    - Also check AGB/Terms pages as these often contain withdrawal info.
    
    🚫 DO NOT REPORT AS MISSING:
    - If there's a link to /agb, /terms, /widerruf - assume withdrawal info EXISTS there
    - If content wasn't fully crawled - assume it EXISTS
    - If you're unsure - assume it EXISTS
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSnippet, confidence (only report if >= 80), verificationNote.`,

    privacy: `You are a Data Privacy Auditor (GDPR/DSGVO).
    
    ⚠️ BENEFIT OF THE DOUBT RULE:
    99% of websites HAVE privacy policies. If you can't find it, assume it EXISTS but wasn't crawled.
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming privacy policy is missing, search for:
    - "Datenschutz", "Privacy", "Privacybeleid", "Data Protection", "Cookie", "GDPR", "DSGVO"
    - Check footer links, legal pages, and cookie banners.
    
    🚫 DO NOT REPORT AS MISSING:
    - If there's a link to /privacy, /datenschutz, /privacybeleid - assume it EXISTS
    - If a cookie banner exists - assume privacy policy EXISTS
    - If you're unsure - assume it EXISTS
    
    ✅ ONLY REPORT if:
    - Privacy policy contains SPECIFIC incorrect information (quote it)
    - Cookie consent mechanism is demonstrably broken (describe exactly how)
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSnippet, confidence (only report if >= 80), verificationNote.`,

    ux: `You are a Translation UX Specialist. Focus ONLY on how translation affects user experience.
    
    STRICT RULES:
    1. Report layout breaks caused by text expansion (German text breaking buttons).
    2. Report partial translations (mixed English/German on same UI element).
    3. Report navigation menus that don't switch language correctly.
    4. IGNORE general usability issues (colors, fonts) unless caused by translation.
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSection, sourceSnippet, confidence (0-100), verificationNote.`,

    company: `You are a Business Intelligence Researcher. Extract ALL company information.
    
    📍 WHERE TO LOOK (in order of priority):
    1. Impressum / Imprint / Colofon pages - MOST RELIABLE for German/Dutch companies
    2. Contact / Kontakt pages - Usually has email, phone, address
    3. About Us / Über Uns / Over Ons pages - Company story, team, founding info
    4. Footer section - Often contains company name, address, VAT
    5. Header/Logo area - Company name
    
    📋 EXTRACT THESE FIELDS (mark as null if not found):
    - name: Full legal company name (e.g., "Mustermann GmbH")
    - industry: What the company does
    - email: Primary contact email
    - phone: Phone number(s)
    - address: Full physical address
    - vat_id: VAT/USt-ID number (format: DE123456789, NL123456789B01)
    - registration_number: Handelsregister/KvK number (e.g., HRB 12345, KVK 12345678)
    - legal_form: GmbH, AG, BV, Ltd, etc.
    - managing_directors: Names of Geschäftsführer/Directors
    - founded: Year founded if mentioned
    - employees: Number of employees if mentioned
    
    🔍 EXTRACTION PATTERNS:
    GERMAN: "Geschäftsführer:", "Inhaber:", "Registergericht:", "Handelsregister:", "USt-IdNr:", "Telefon:"
    DUTCH: "Directeur:", "Eigenaar:", "Bestuurder:", "KvK:", "BTW-nummer:", "Telefoon:", "Adres:"
    ENGLISH: "Managing Director:", "CEO:", "VAT:", "Phone:", "Registration:"
    
    - Look for address patterns: Street + Number, Postal Code + City
    - German postal: 5 digits (e.g., 10115 Berlin)
    - Dutch postal: 4 digits + 2 letters (e.g., 1234 AB Amsterdam)
    
    STRICT RULES:
    1. Extract EXACTLY what you find - do not infer or guess
    2. If a field is not clearly visible, set it to null
    3. Include the sourceUrl where you found each piece of information
    4. Format phone numbers consistently (+49 xxx xxx)
    
    Return as structured JSON with all fields.`,

    localization: `You are a German Localization Specialist. Check TRANSLATION STRUCTURE ANALYSIS first.
    
    🔍 EXPLICIT MACHINE TRANSLATION DETECTION:
    Look for these signs of Google Translate / Machine Translation:
    1. Language switcher exists BUT no language subfolders (/de/, /en/, /nl/) in URLs
    2. "Translated by Google" or "Google Translate" visible anywhere
    3. gtranslate, weglot, or similar translation widget scripts
    4. Mixed languages in same paragraph (half German, half English)
    5. Unnatural German phrasing that sounds like literal English translation
    
    If machine translation detected -> severity: HIGH, confidence: 90+
    Include SPECIFIC evidence (quote the broken text, cite the URL pattern)
    
    FOR EACH FINDING include: sourceUrl, sourceSnippet (QUOTE THE BAD TEXT), confidence (90+ for machine translation), verificationNote.`,

    translation: `You are a Translation QA Expert. BE EXPLICIT about machine translation.
    
    🚨 MACHINE TRANSLATION IS A CRITICAL FINDING - always report if detected:
    
    DETECTION METHODS:
    1. URL STRUCTURE: Check if site has language switcher but NO language subfolders:
       - Bad: example.com (same URL for all languages, using JS translation)
       - Good: example.com/de/, example.com/en/ (proper localization)
    2. TRANSLATION WIDGETS: Look for gtranslate, Google Translate, Weglot, etc.
    3. TEXT QUALITY: Unnatural phrasing, impossible grammar, wrong idioms
    4. MIXED LANGUAGES: Same UI element shows two languages
    
    If you detect machine translation:
    - severity: HIGH
    - confidence: 90-100
    - Problem: "Website uses machine translation (Google Translate/[widget name])"
    - Explanation: Quote specific broken text or describe URL structure issue
    - Recommendation: "Hire professional translator for German market"
    
    This is NOT subject to benefit-of-the-doubt. ALWAYS REPORT machine translation.
    FOR EACH FINDING include: sourceUrl, sourceSnippet (QUOTE THE EVIDENCE), confidence (90+ for confirmed), verificationNote.`
}


const COMPILER_INSTRUCTION = `You are the Lead Auditor. Combine analyses into a JSON Deep Audit Report.
YOU MUST RESPOND WITH ONLY VALID JSON.

CRITICAL FILTERING RULES:
1. EXCLUDE any finding with confidence < 70 (these are uncertain)
2. EXCLUDE any finding that says "could not verify" or "uncertain"
3. If an agent found that something EXISTS (e.g., "Impressum found"), do NOT include it as a finding
4. Only include VERIFIED ISSUES, not observations
5. ALWAYS INCLUDE machine translation findings - these are critical

Required structure:
{
  "overview": "Executive summary...",
  "companyInfo": { 
    "name": "...", 
    "industry": "...", 
    "email": "...", 
    "phone": "...", 
    "vat_id": "...", 
    "registration_number": "...", 
    "managing_directors": [], 
    "legal_form": "...",
    "contacts": [] 
  },
  "sections": [{ 
    "title": "...", 
    "findings": [{ 
      "problem": "...", 
      "explanation": "...", 
      "recommendation": "...", 
      "severity": "high|medium|low", 
      "sourceUrl": "...",
      "sourceSection": "Footer|Header|Legal Page|etc",
      "sourceSnippet": "exact 30-50 char quote",
      "confidence": 70-100,
      "verificationNote": "..." 
    }] 
  }],
  "conclusion": "...",
  "actionList": ["Dynamically generated based on findings"]
}

🎯 DYNAMIC ACTION LIST RULES:
Generate actionList based ONLY on the actual issues found in the report:

- If Machine Translation detected → "Hire professional translator for the German market"
- If Privacy issues found → "Update privacy policy to comply with GDPR"
- If Impressum issues found → "Add required legal information to Impressum"
- If Withdrawal issues found → "Add clear 14-day withdrawal notice to checkout"
- If Cookie consent issues → "Implement GDPR-compliant cookie consent banner"
- If Contact info missing → "Add business contact details to website"
- If Terms issues found → "Review and update Terms and Conditions"

DO NOT include generic actions. ONLY include actions that address SPECIFIC issues in the report.
If there are no findings, actionList should be: ["No critical issues found - maintain current compliance standards"]

RULES:
1. EVERY finding MUST have all fields including sourceSection, sourceSnippet, confidence
2. severity MUST be high, medium, or low
3. For companyInfo: If a value is "Not found" or unknown, set it to null or OMIT the key
4. Machine Translation is ALWAYS high severity - never filter it out
5. REMOVE findings with confidence < 70 EXCEPT machine translation findings`

// ENHANCED Verification function to filter false positives
// Searches ALL crawled content for terms before reporting as missing
function verifyMissingFindings(report: any, allPages: any[]): any {
    if (!report?.sections || !Array.isArray(report.sections)) return report

    // COMPREHENSIVE terms that indicate something is present (multi-language, 100+ terms)
    const presenceTerms: Record<string, string[]> = {
        'impressum': [
            'impressum', 'imprint', 'legal notice', 'colofon', 'legal info',
            'angaben gemäß', 'verantwortlich', 'betreiber', 'herausgeber',
            'inhaltlich verantwortlich', 'seitenbetreiber', 'anbieterkennzeichnung',
            'company information', 'site notice', 'legal disclosure', 'publisher',
            'responsible for content', 'gemäß § 5 tmg', '§ 5 telemediengesetz',
            'handelsregister', 'registergericht', 'ust-id', 'ust-idnr', 'vat id',
            'geschäftsführer', 'managing director', 'ceo', 'inhaber', 'owner'
        ],
        'privacy': [
            'datenschutz', 'privacy', 'privacybeleid', 'data protection', 'gdpr', 'dsgvo',
            'privacyverklaring', 'gegevensbescherming', 'datenschutzerklärung',
            'privacy policy', 'privacy statement', 'personenbezogene daten',
            'verarbeitung ihrer daten', 'cookies', 'tracking', 'google analytics',
            'data we collect', 'how we use your data', 'your privacy rights',
            'art. 13 dsgvo', 'artikel 13', 'verantwortlicher', 'data controller',
            'datenschutzbeauftragter', 'data protection officer', 'dpo',
            'rechtsgrundlage', 'legal basis', 'berechtigtes interesse', 'legitimate interest'
        ],
        'terms': [
            'agb', 'terms', 'conditions', 'algemene voorwaarden', 'nutzungsbedingungen',
            'terms of service', 'terms of use', 'terms and conditions', 'tos',
            'allgemeine geschäftsbedingungen', 'vertragsbestimmungen', 'kaufbedingungen',
            'user agreement', 'service agreement', 'acceptable use', 'terms apply',
            'by using this', 'geltungsbereich', 'vertragsschluss', 'lieferung'
        ],
        'withdrawal': [
            'widerruf', 'withdrawal', 'return', 'refund', 'retour', 'rückgabe',
            '14 tage', '14 days', 'widerrufsrecht', 'widerrufsbelehrung',
            'right of withdrawal', 'cancellation right', 'herroeping', 'herroepingsrecht',
            'rückgaberecht', 'umtausch', 'exchange', 'money back', 'geld zurück',
            'widerrufsfrist', 'cooling off', 'retourbeleid', 'return policy'
        ],
        'contact': [
            'kontakt', 'contact', 'kontaktieren', 'contact us', 'get in touch',
            'neem contact op', 'erreichen sie uns', 'schreiben sie uns',
            'e-mail', 'email', 'telefon', 'phone', 'tel:', 'fax', '@',
            'anschrift', 'address', 'adresse', 'postadresse', 'standort'
        ],
        'shipping': [
            'versand', 'shipping', 'delivery', 'lieferung', 'verzending',
            'versandkosten', 'shipping costs', 'lieferzeit', 'delivery time',
            'bezorging', 'versandarten', 'shipping methods', 'dhl', 'ups', 'dpd',
            'kostenloser versand', 'free shipping', 'gratis verzending'
        ],
        'payment': [
            'zahlung', 'payment', 'bezahlung', 'betaling', 'zahlungsarten',
            'payment methods', 'kreditkarte', 'credit card', 'paypal', 'klarna',
            'sofort', 'überweisung', 'bank transfer', 'rechnung', 'invoice',
            'vorkasse', 'prepayment', 'zahlungsbedingungen', 'payment terms'
        ],
        'cookie': [
            'cookie', 'cookies', 'cookie policy', 'cookie-richtlinie', 'cookiebeleid',
            'we use cookies', 'wir verwenden cookies', 'cookie consent', 'cookie banner',
            'essential cookies', 'notwendige cookies', 'tracking cookies', 'analytics'
        ]
    }

    // Build searchable content from ALL pages (not just legal)
    const allContent = allPages
        .map(p => ((p.markdown || '') + ' ' + (p.title || '') + ' ' + (p.url || '')).toLowerCase())
        .join('\n\n')

    console.log(`[Verification] Searching ${allPages.length} pages, ${allContent.length} total characters`)

    const verifiedSections = report.sections.map((section: any) => {
        if (!section.findings || !Array.isArray(section.findings)) return section

        const verifiedFindings = section.findings.filter((finding: any) => {
            const problem = (finding.problem || '').toLowerCase()
            const explanation = (finding.explanation || '').toLowerCase()
            const fullText = problem + ' ' + explanation

            // EXCEPTION: NEVER filter out translation/machine translation findings
            const translationTerms = ['machine translation', 'google translate', 'gtranslate', 'weglot',
                'translation quality', 'translated by', 'maschinenübersetzung', 'auto-translate',
                'language switcher', 'no language subfolders', 'translation widget']
            const isTranslationFinding = translationTerms.some(term => fullText.includes(term))
            if (isTranslationFinding) {
                console.log(`[Verification] KEEPING translation finding: "${problem.substring(0, 50)}..."`)
                return true  // ALWAYS keep translation findings
            }

            // Check if this is a "missing" type finding
            const missingIndicators = [
                'missing', 'not found', 'keine', 'fehlt', 'absent', 'no ',
                'could not find', 'does not have', 'lacks', 'without',
                'nicht vorhanden', 'not present', 'unavailable', 'nicht gefunden',
                'ontbreekt', 'geen', 'niet aanwezig' // Dutch
            ]

            const isMissingFinding = missingIndicators.some(ind => fullText.includes(ind))
            if (!isMissingFinding) return true  // Keep non-missing findings

            // BENEFIT OF THE DOUBT: For common legal items, assume they exist
            // 99% of legitimate businesses have these, so only report if we're CERTAIN they're missing
            const commonItems = ['impressum', 'imprint', 'privacy', 'datenschutz', 'terms', 'agb', 'contact', 'kontakt', 'cookie']
            const isAboutCommonItem = commonItems.some(item => fullText.includes(item))

            if (isAboutCommonItem) {
                // For common items: ASSUME PRESENT unless we searched and found nothing
                // If we have less than 3 pages of content, we probably didn't crawl well - assume it's there
                if (allPages.length < 3) {
                    console.log(`[Verification] BENEFIT OF DOUBT: Only ${allPages.length} pages crawled, assuming common items exist`)
                    return false  // Filter out this finding
                }
            }

            // Check what item is claimed to be missing
            let foundInContent = false
            let matchedCategory = ''

            for (const [category, terms] of Object.entries(presenceTerms)) {
                // Check if the finding is about this category
                const isAboutThisCategory = terms.some(t => fullText.includes(t)) || fullText.includes(category)

                if (isAboutThisCategory) {
                    // Search ALL content for ANY of these terms
                    const foundTerm = terms.find(term => allContent.includes(term))
                    if (foundTerm) {
                        foundInContent = true
                        matchedCategory = category
                        console.log(`[Verification] FALSE POSITIVE BLOCKED: Claimed "${category}" missing but found "${foundTerm}" in content`)
                        break
                    }
                }
            }

            // Additional: Check for common legal document structure patterns
            if (!foundInContent && (fullText.includes('impressum') || fullText.includes('imprint'))) {
                // Look for typical Impressum content patterns
                const impressumPatterns = [
                    /\bgmbh\b/, /\bkg\b/, /\bag\b/, /\bltd\b/, /\bllc\b/, /\bsrl\b/, /\bbv\b/,
                    /geschäftsführer/i, /managing director/i, /ceo/i,
                    /handelsregister/i, /hrb\s*\d+/i, /commercial register/i,
                    /ust-id/i, /vat/i, /btw/i, /ust\.?\s*id/i,
                    /\d{5}\s+[a-zäöü]+/i,  // German postal code + city
                    /\+49|\+31|\+32|\+43/   // Phone numbers
                ]
                if (impressumPatterns.some(pattern => pattern.test(allContent))) {
                    foundInContent = true
                    console.log(`[Verification] FALSE POSITIVE BLOCKED: Found Impressum-like content patterns`)
                }
            }

            return !foundInContent
        })

        const removed = section.findings.length - verifiedFindings.length
        if (removed > 0) {
            console.log(`[Verification] Removed ${removed} false positives from section "${section.title}"`)
        }

        return { ...section, findings: verifiedFindings }
    })

    return { ...report, sections: verifiedSections }
}

export async function executeAuditWorkflow(
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

    // Smart context truncation
    // INCREASED: Now safe with pre-crawled data from crawl-website function
    const contextLimit = 120000  // 120k characters
    const safeContext: any = {
        translationStructure: fullData?.translationStructure || "Not available",
        company: fullData?.company || {},
        contact: fullData?.contact || {},
        pages: [],
        legalPagesFound: fullData?.legalPagesFound || 0,
        totalPages: fullData?.totalPages || 0
    }

    let currentLength = JSON.stringify(safeContext).length
    const sourcePages = Array.isArray(fullData?.pages) ? fullData.pages : []

    // Prioritize legal pages in context
    const legalPages = sourcePages.filter((p: any) => p.pageType === 'legal')
    const otherPages = sourcePages.filter((p: any) => p.pageType !== 'legal')
    const orderedPages = [...legalPages, ...otherPages]

    for (const page of orderedPages) {
        const pSize = (page.markdown?.length || 0)
        if (currentLength + pSize + 200 > contextLimit) break
        safeContext.pages.push(page)
        currentLength += pSize + 50
    }

    const contextString = JSON.stringify(safeContext, null, 2)
    const baseContext = `Analyze this website: ${url}\n\nIMPORTANT: ${safeContext.legalPagesFound} legal pages were found and included. Check legal pages carefully before claiming anything is missing.\n\n[CONTEXT START]\n${contextString}\n[CONTEXT END]`

    let res1, res2, res3, res4, res5, res6, res11

    if (cachedData) {
        await updateStatus('Restoring previous agent findings...')
        res1 = cachedData.legal; res2 = cachedData.consumer; res3 = cachedData.privacy
        res4 = cachedData.ux; res5 = cachedData.company; res6 = cachedData.localization
        res11 = cachedData.translationQuality
    } else {
        await updateStatus('Deploying 7 AI Auditor Agents...')

        await updateStatus('Deploying ALL 7 AI Auditor Agents (Parallel Swarm)...')

        let agentsFinished = 0
        const callAgent = async (instruction: string, name: string) => {
            console.log(`[Agent ${name}] Starting...`)
            try {
                // Use gpt-4o-mini for speed and reliability, with 0 retries to prevent timeouts
                const res = await callOpenAI(apiKey, instruction, [{ role: 'user', content: baseContext }], 'gpt-4o-mini', undefined, 0.5, 4000, 0)
                agentsFinished++
                console.log(`[Agent ${name}] Done (${res.length} chars)`)
                return res || `Agent ${name}: No issues found.`
            } catch (e) {
                agentsFinished++
                console.error(`[Agent ${name}] Failed:`, e)
                return `Agent ${name}: Analysis unavailable.`
            }
        }

        const updateProgress = async () => {
            while (agentsFinished < 7) {
                await updateStatus(`Audit Swarm Analyzing: ${agentsFinished}/7 Agents Complete...`)
                await new Promise(r => setTimeout(r, 1500))
            }
        }

        // Execute ALL agents in parallel to maximize speed within the wall-clock limit
        const [r1, r2, r3, r4, r5, r6, r11] = await Promise.all([
            callAgent(AGENT_INSTRUCTIONS.legal, 'Legal'),
            callAgent(AGENT_INSTRUCTIONS.consumer, 'Consumer'),
            callAgent(AGENT_INSTRUCTIONS.privacy, 'Privacy'),
            callAgent(AGENT_INSTRUCTIONS.ux, 'UX'),
            callAgent(AGENT_INSTRUCTIONS.company, 'Company'),
            callAgent(AGENT_INSTRUCTIONS.localization, 'Localization'),
            callAgent(AGENT_INSTRUCTIONS.translation, 'Translation'),
            updateProgress()
        ])

        // Map results variables
        res1 = r1; res2 = r2; res3 = r3; res4 = r4; res5 = r5
        res6 = r6; res11 = r11
    }

    const allAgentData = {
        legal: res1, consumer: res2, privacy: res3, ux: res4, company: res5,
        localization: res6, translationQuality: res11
    }

    if (onAgentsComplete) await onAgentsComplete(allAgentData)

    await updateStatus('Consolidating agent findings into final report...')

    const safeRes = (r: any) => (r && typeof r === 'string' && r.length > 0) ? r : 'No analysis available.'
    const truncate = (s: string, max: number = 2000) => s.length > max ? s.substring(0, max) + '...[truncated]' : s

    const compilerMessages = [
        { role: 'user', content: `Compile audit report for: ${url}` },
        { role: 'assistant', content: `Legal: ${truncate(safeRes(res1))}` },
        { role: 'assistant', content: `Consumer: ${truncate(safeRes(res2))}` },
        { role: 'assistant', content: `Privacy: ${truncate(safeRes(res3))}` },
        { role: 'assistant', content: `UX: ${truncate(safeRes(res4))}` },
        { role: 'assistant', content: `Company: ${truncate(safeRes(res5))}` },
        { role: 'assistant', content: `Localization: ${truncate(safeRes(res6))}` },
        { role: 'assistant', content: `Translation: ${truncate(safeRes(res11))}` }
    ]

    let resCompiler
    try {
        resCompiler = await callOpenAI(apiKey, COMPILER_INSTRUCTION, compilerMessages, 'gpt-4o-mini', { type: "json_object" }, 0.1, 16000)
    } catch (compilerError) {
        console.error('Compiler failed:', compilerError)
        // Fallback report
        return {
            overview: "Consolidation failed. Agent findings preserved below.",
            companyInfo: { name: url.replace(/https?:\/\//, '').split('/')[0], contacts: [] },
            sections: [{ title: "Raw Findings", findings: [{ problem: "Fallback Report", explanation: truncate(safeRes(res1), 500), recommendation: "Retry audit", severity: "medium", verificationNote: "Fallback" }] }],
            conclusion: "Partial audit completed.",
            actionList: ["Review raw data", "Retry if needed"],
            score: 50
        }
    }

    await updateStatus('Finalizing report structure...')

    try {
        const firstBrace = resCompiler.indexOf('{')
        const lastBrace = resCompiler.lastIndexOf('}')
        if (firstBrace === -1 || lastBrace === -1) throw new Error('Invalid JSON')

        const cleanJson = resCompiler.substring(firstBrace, lastBrace + 1)
        let parsed
        try {
            parsed = JSON.parse(cleanJson)
        } catch (parseError) {
            const fixedJson = cleanJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
            parsed = JSON.parse(fixedJson)
        }

        // Apply verification to filter false positives - search ALL pages
        const verified = verifyMissingFindings(parsed, safeContext.pages)
        console.log(`[Verification] Filtered false positives. Before: ${parsed.sections?.reduce((a: number, s: any) => a + (s.findings?.length || 0), 0)} findings, After: ${verified.sections?.reduce((a: number, s: any) => a + (s.findings?.length || 0), 0)} findings`)

        const sections = verified.sections || []
        const totalFindings = sections.reduce((acc: number, s: any) => acc + (s.findings?.length || 0), 0)

        // GENERATE DYNAMIC ACTION LIST based on actual findings
        const allFindingsText = sections
            .flatMap((s: any) => (s.findings || []).map((f: any) =>
                `${f.problem || ''} ${f.explanation || ''} ${f.recommendation || ''}`.toLowerCase()
            ))
            .join(' ')

        const dynamicActions: string[] = []

        // Only add actions if corresponding issues exist
        if (allFindingsText.includes('machine translation') ||
            allFindingsText.includes('google translate') ||
            allFindingsText.includes('gtranslate') ||
            allFindingsText.includes('translation quality')) {
            dynamicActions.push('Hire professional translator for the German market')
        }
        if (allFindingsText.includes('privacy') || allFindingsText.includes('datenschutz') || allFindingsText.includes('gdpr') || allFindingsText.includes('dsgvo')) {
            dynamicActions.push('Update privacy policy to comply with GDPR')
        }
        if (allFindingsText.includes('impressum') || allFindingsText.includes('imprint') || allFindingsText.includes('legal notice')) {
            dynamicActions.push('Add required legal information to Impressum')
        }
        if (allFindingsText.includes('withdrawal') || allFindingsText.includes('widerruf') || allFindingsText.includes('return policy')) {
            dynamicActions.push('Add clear 14-day withdrawal notice to checkout')
        }
        if (allFindingsText.includes('cookie') || allFindingsText.includes('consent')) {
            dynamicActions.push('Implement GDPR-compliant cookie consent banner')
        }
        if (allFindingsText.includes('contact') || allFindingsText.includes('kontakt') || allFindingsText.includes('email') || allFindingsText.includes('phone')) {
            dynamicActions.push('Add business contact details to website')
        }
        if (allFindingsText.includes('terms') || allFindingsText.includes('agb') || allFindingsText.includes('conditions')) {
            dynamicActions.push('Review and update Terms and Conditions')
        }

        // If no specific actions, provide default based on score
        if (dynamicActions.length === 0) {
            dynamicActions.push('No critical issues found - maintain current compliance standards')
        }

        // Replace AI-generated actionList with our dynamic one
        verified.actionList = dynamicActions
        console.log(`[ActionList] Generated ${dynamicActions.length} actions based on findings:`, dynamicActions)

        // GENERATE ACCURATE OVERVIEW based on actual findings
        const highSeverityCount = sections.reduce((acc: number, s: any) =>
            acc + (s.findings || []).filter((f: any) => f.severity?.toLowerCase() === 'high').length, 0)
        const mediumSeverityCount = sections.reduce((acc: number, s: any) =>
            acc + (s.findings || []).filter((f: any) => f.severity?.toLowerCase() === 'medium').length, 0)
        const lowSeverityCount = sections.reduce((acc: number, s: any) =>
            acc + (s.findings || []).filter((f: any) => f.severity?.toLowerCase() === 'low').length, 0)

        // Build overview based on actual findings
        let dynamicOverview = ''
        if (totalFindings === 0) {
            dynamicOverview = `This website audit found no critical compliance issues. The site appears to meet German and EU legal requirements for e-commerce. Regular monitoring is recommended to maintain compliance.`
        } else {
            const issuesSummary: string[] = []

            // Describe what was found
            if (allFindingsText.includes('machine translation') || allFindingsText.includes('google translate')) {
                issuesSummary.push('machine translation detected')
            }
            if (allFindingsText.includes('privacy') || allFindingsText.includes('datenschutz')) {
                issuesSummary.push('privacy policy concerns')
            }
            if (allFindingsText.includes('impressum') || allFindingsText.includes('imprint')) {
                issuesSummary.push('Impressum issues')
            }
            if (allFindingsText.includes('withdrawal') || allFindingsText.includes('widerruf')) {
                issuesSummary.push('withdrawal policy concerns')
            }
            if (allFindingsText.includes('cookie')) {
                issuesSummary.push('cookie consent issues')
            }

            const severityText = highSeverityCount > 0
                ? `${highSeverityCount} high-severity issue${highSeverityCount > 1 ? 's' : ''}`
                : mediumSeverityCount > 0
                    ? `${mediumSeverityCount} medium-severity issue${mediumSeverityCount > 1 ? 's' : ''}`
                    : `${lowSeverityCount} minor issue${lowSeverityCount > 1 ? 's' : ''}`

            dynamicOverview = `This audit identified ${totalFindings} finding${totalFindings > 1 ? 's' : ''}, including ${severityText}. `
            if (issuesSummary.length > 0) {
                dynamicOverview += `Key areas requiring attention: ${issuesSummary.join(', ')}. `
            }
            dynamicOverview += `Review the detailed findings below and address high-priority items first.`
        }

        verified.overview = dynamicOverview
        console.log(`[Overview] Generated based on ${totalFindings} findings`)

        const sectionScores = sections.map((section: any) => {
            let score = 100
            section.findings?.forEach((f: any) => {
                const sev = f.severity?.toLowerCase()
                if (sev === 'high') score -= 25
                else if (sev === 'medium') score -= 10
                else if (sev === 'low') score -= 4
            })
            return Math.max(0, score)
        })
        let calculatedScore = sectionScores.length > 0 ? Math.round(sectionScores.reduce((a: number, b: number) => a + b, 0) / sectionScores.length) : 100
        calculatedScore = Math.max(5, calculatedScore)

        return { ...verified, issuesCount: totalFindings, score: calculatedScore }
    } catch (e) {
        console.error('Failed to parse report:', e)
        throw new Error(`Failed to generate report: ${(e as Error).message}`)
    }
}
