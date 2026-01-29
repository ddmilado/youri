// AI Agent instructions and workflow execution

import { callOpenAI } from './openai.ts'
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

    translation: `You are a Translation QA Expert. Determine if the site uses proper Human Translation or Machine Translation.
    
    ANALYSIS REQUIRED - YOU MUST DETERMINE STATUS:
    
    1. MACHINE TRANSLATION SIGNS (Negative):
       - URL Structure: Same URL for all languages, or uses query params (?lang=de) instead of subfolders
       - Widgets: Google Translate, GTranslate, Weglot widgets visible
       - Content: Mixed languages, unnatural phrasing, "Translated by Google" text
    
    2. HUMAN TRANSLATION SIGNS (Positive):
       - URL Structure: Clear subfolders (/de/, /en/, /nl/) or subdomains (de.example.com)
       - Content: High-quality, idiomatic German
       - Structure: Different DOM structure per language (not just text replacement)
    
    REPORTING:
    - If Machine Translation (Confidence 90%+): Severity HIGH, Problem "Probable Machine Translation Detected", Explain WHY (framing it as a high probability).
    - If Human Translation: Report "Human Translation Verified" as a finding with Low severity (positive finding), explaining validation.
    
    FOR EACH FINDING include: sourceUrl, sourceSnippet, confidence, verificationNote.`
}


const COMPILER_INSTRUCTION = `You are the Lead Auditor. Combine analyses into a JSON Deep Audit Report.
YOU MUST RESPOND WITH ONLY VALID JSON.

CRITICAL FILTERING RULES:
1. EXCLUDE any finding with confidence < 95 (these are uncertain)
2. EXCLUDE any finding that says "could not verify" or "uncertain"
3. If an agent found that something EXISTS (e.g., "Impressum found"), do NOT include it as a finding
4. Only include VERIFIED ISSUES, not observations
5. ALWAYS INCLUDE a specific finding for "Translation Analysis" in the sections - this is MANDATORY even if positive

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
      "severity": "high|medium|low|info", 
      "sourceUrl": "...",
      "sourceSection": "...",
      "sourceSnippet": "...",
      "confidence": 70-100,
      "verificationNote": "..." 
    }] 
  }],
  "translationAnalysis": {
      "status": "Machine Translation Detected | Human Translation Verified | Unknown",
      "reasoning": "...",
      "evidence": "..."
  },
  "conclusion": "...",
  "actionList": ["..."]
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
2. severity MUST be high, medium, low, or INFO (for positive translation findings)
3. For companyInfo: If a value is "Not found" or unknown, set it to null or OMIT the key
4. Machine Translation is ALWAYS high severity. Human Translation is INFO severity.
5. REMOVE findings with confidence < 95 EXCEPT translation findings (keep ALL translation findings)
6. ALWAYS fill the "translationAnalysis" object - it is MANDATORY`

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
                'language switcher', 'no language subfolders', 'translation widget', 'human translation',
                'proper localization', 'native speaker']
            const isTranslationFinding = translationTerms.some(term => fullText.includes(term))
            if (isTranslationFinding) {
                console.log(`[Verification] KEEPING translation finding: "${problem.substring(0, 50)}..."`)
                return true  // ALWAYS keep translation findings (good or bad)
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
                    console.log(`[Verification] FALSE POSITIVE BLOCKED: Found Impressum - like content patterns`)
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
    onAgentsComplete?: (data: any) => Promise<void>,
    job_id?: string
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
    const baseContext = `Analyze this website: ${url} \n\nIMPORTANT: ${safeContext.legalPagesFound} legal pages were found and included.Check legal pages carefully before claiming anything is missing.\n\n[CONTEXT START]\n${contextString} \n[CONTEXT END]`

    // RAG RETRIEVAL HELPER
    const retrieveContext = async (query: string, job_id: string, supabase: any): Promise<string> => {
        try {
            const embedding = await generateEmbedding(query, apiKey)
            const { data, error } = await supabase.rpc('match_document_chunks', {
                query_embedding: embedding,
                match_threshold: 0.5, // 0.5 is a reasonable start
                match_count: 8,       // Get top 8 relevant chunks
                filter_job_id: job_id
            })

            if (error) {
                console.error('RAG Retrieval Error:', error)
                return ''
            }

            if (!data || data.length === 0) return ''

            return data.map((d: any) =>
                `[SOURCE: ${d.url}]\n${d.content}\n[END SOURCE]`
            ).join('\n\n')
        } catch (e) {
            console.error('Retrieval Exception:', e)
            return ''
        }
    }

    // UPDATE AGENT INSTRUCTIONS TO FORCE CITATION
    // We append this requirement to all agents
    const CITATION_INSTRUCTION = `
    IMPORTANT: You have been provided with RELEVANT CONTEXT CHUNKS.
    - Uses these chunks as your primary source of truth.
    - Each chunk starts with [SOURCE: url].
    - When you report a finding, you MUST include the "sourceUrl" field.
    - If the chunk has a source URL, use it.
    - DO NOT HALLUCINATE URLs.`


    let res1: any, res2: any, res3: any, res4: any, res5: any, res6: any, res11: any

    if (cachedData) {
        await updateStatus('Restoring previous agent findings...')
        res1 = cachedData.legal; res2 = cachedData.consumer; res3 = cachedData.privacy
        res4 = cachedData.ux; res5 = cachedData.company; res6 = cachedData.localization
        res11 = cachedData.translationQuality
    } else {
        await updateStatus('Deploying 7 AI Auditor Agents (RAG Enhanced)...')

        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

        // Define specific queries for each agent to retrieve best chunks
        const retrievalQueries: Record<string, string> = {
            'Legal': 'impressum imprint legal notice terms conditions agb anbieterkennzeichnung verantwortlich nutzungsbedingungen',
            'Consumer': 'withdrawal return refund widerruf cancellaton shipping rückgabe widerrufsrecht',
            'Privacy': 'privacy datenschutz cookie gdpr data protection datenschutzerklärung personen bezogene daten',
            'Company': 'contact address email vat id phone company number kontakt adresse ust-id handelsregister',
            'Localization': 'language translation english german localization sprache übersetzung',
            'Translation': 'translation quality machine google translate text übersetzungsfehler'
        }

        let agentsFinished = 0
        const callAgent = async (instruction: string, name: string) => {
            console.log(`[Agent ${name}] Starting...`)
            let ragContext = ''

            if (job_id) {
                const query = retrievalQueries[name] || name
                const chunks = await retrieveContext(query, job_id, supabase)
                if (chunks) {
                    ragContext = `\n\n[SPECIFIC RETRIEVED CONTENT FOR ${name.toUpperCase()} AGENT]\n${chunks}\n\n${CITATION_INSTRUCTION}`
                }
            }

            try {
                // Combine Base Context (Structure) + RAG Context (Specific Details)
                const messages = [
                    { role: 'user', content: baseContext + ragContext }
                ]

                const res = await callOpenAI(apiKey, instruction, messages, 'gpt-4o-mini', undefined, 0.5, 4000, 0)
                agentsFinished++
                console.log(`[Agent ${name}]Done(${res.length} chars)`)
                return res || `Agent ${name}: No issues found.`
            } catch (e) {
                agentsFinished++
                console.error(`[Agent ${name}]Failed: `, e)
                return `Agent ${name}: Analysis unavailable.`
            }
        }

        const updateProgress = async () => {
            while (agentsFinished < 6) {
                await updateStatus(`Audit Swarm Analyzing: ${agentsFinished}/6 Agents Complete...`)
                await new Promise(r => setTimeout(r, 1500))
            }
        }

        const [r1, r2, r3, r5, r6, r11] = await Promise.all([
            callAgent(AGENT_INSTRUCTIONS.legal, 'Legal'),
            callAgent(AGENT_INSTRUCTIONS.consumer, 'Consumer'),
            callAgent(AGENT_INSTRUCTIONS.privacy, 'Privacy'),
            callAgent(AGENT_INSTRUCTIONS.company, 'Company'),
            callAgent(AGENT_INSTRUCTIONS.localization, 'Localization'),
            callAgent(AGENT_INSTRUCTIONS.translation, 'Translation'),
            updateProgress()
        ])

        res1 = r1; res2 = r2; res3 = r3; res5 = r5
        res6 = r6; res11 = r11
    }

    const allAgentData = {
        legal: res1, consumer: res2, privacy: res3, company: res5,
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



        // GENERATE DYNAMIC ACTION LIST based on actual findings AND translation analysis
        const allFindingsText = sections
            .flatMap((s: any) => (s.findings || []).map((f: any) =>
                `${f.problem || ''} ${f.explanation || ''} ${f.recommendation || ''}`.toLowerCase()
            ))
            .join(' ')

        const dynamicActions: string[] = []

        // CHECK TRANSLATION ANALYSIS STATUS
        const translationStatus = verified.translationAnalysis?.status?.toLowerCase() || ''
        const machineTranslationDetected = translationStatus.includes('machine translation') ||
            translationStatus.includes('detected') ||
            allFindingsText.includes('machine translation') ||
            allFindingsText.includes('google translate')

        // Only add actions if corresponding issues exist
        if (machineTranslationDetected) {
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
        if (totalFindings === 0 && !machineTranslationDetected) {
            dynamicOverview = `This website audit found no critical compliance issues. The site appears to meet German and EU legal requirements for e-commerce. Regular monitoring is recommended to maintain compliance.`
        } else {
            const issuesSummary: string[] = []

            // Describe what was found
            if (machineTranslationDetected) {
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
            if (verified.translationAnalysis?.status) {
                dynamicOverview += ` Translation Status: ${verified.translationAnalysis.status}.`
            }
            dynamicOverview += ` Review the detailed findings below.`
        }

        // ALWAYS Append Translation Analysis to Overview
        if (verified.translationAnalysis?.status && verified.translationAnalysis?.reasoning) {
            const status = verified.translationAnalysis.status;
            const reasoning = verified.translationAnalysis.reasoning;

            // Format: "Translation Analysis: [Status] - [Reasoning]"
            // Only add if not already redundant
            if (!dynamicOverview.includes(reasoning)) {
                dynamicOverview += `\n\nTranslation Analysis: ${status}. ${reasoning}`
            }
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

        // GENERATE ACCURATE CONCLUSION based on findings and score
        let dynamicConclusion = ''
        if (totalFindings === 0) {
            dynamicConclusion = `This website demonstrates strong compliance with German and EU e-commerce regulations. No critical issues were identified during this audit. Continue maintaining current legal standards and perform periodic reviews to ensure ongoing compliance.`
        } else if (calculatedScore >= 80) {
            dynamicConclusion = `Overall, this website shows good compliance with most German and EU requirements. ${totalFindings} minor issue${totalFindings > 1 ? 's were' : ' was'} identified that should be addressed to improve compliance. The site is generally well-prepared for the German market.`
        } else if (calculatedScore >= 60) {
            dynamicConclusion = `This website has several compliance gaps that require attention. ${highSeverityCount > 0 ? `${highSeverityCount} high-priority issue${highSeverityCount > 1 ? 's' : ''} should be addressed immediately. ` : ''}We recommend reviewing the findings and implementing the suggested actions to improve market readiness.`
        } else {
            dynamicConclusion = `This audit identified significant compliance issues that need urgent attention before targeting the German market. ${highSeverityCount > 0 ? `${highSeverityCount} critical issue${highSeverityCount > 1 ? 's require' : ' requires'} immediate action. ` : ''}We strongly recommend addressing all high and medium severity findings before launch.`
        }

        verified.conclusion = dynamicConclusion
        console.log(`[Conclusion] Generated based on score ${calculatedScore} and ${totalFindings} findings`)

        return { ...verified, issuesCount: totalFindings, score: calculatedScore }
    } catch (e) {
        console.error('Failed to parse report:', e)
        throw new Error(`Failed to generate report: ${(e as Error).message}`)
    }
}
