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

// Agent Instructions - CONSERVATIVE approach to reduce false positives
const AGENT_INSTRUCTIONS = {
    legal: `You are a German & EU Legal Specialist. Focus ONLY on missing Impressum (Imprint), AGB (Terms), and GDPR requirements.
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming ANYTHING is "missing", you MUST search for these exact terms in the content:
    - Impressum: "Impressum", "Imprint", "Legal Notice", "Colofon", "Angaben gemäß", "Legal Info", "Verantwortlich"
    - Terms: "AGB", "Terms", "Conditions", "Algemene Voorwaarden", "Terms of Service", "Nutzungsbedingungen"
    - Privacy: "Datenschutz", "Privacy", "Privacybeleid", "Data Protection", "DSGVO", "GDPR"
    
    If ANY of these terms appear with relevant content, DO NOT report as missing.
    If you are UNCERTAIN, set confidence below 50 and note "Could not verify presence" instead of claiming missing.
    
    STRICT RULES:
    1. If legal documents exist in ANY language (German, English, Dutch), acknowledge them as present.
    2. IGNORE "missing contact information" if Email or Phone is visible ANYWHERE on the site.
    3. Report ONLY verified issues with confidence >= 70.
    
    FOR EACH FINDING include:
    - problem, explanation, recommendation, severity
    - sourceUrl: Full page URL where issue exists
    - sourceSection: Specific section (e.g., "Footer", "Legal Page", "Contact Section")
    - sourceSnippet: Copy 30-50 chars of relevant text verbatim
    - confidence: 0-100 (only report if >= 70)
    - verificationNote: How you verified this finding`,

    consumer: `You are a Consumer Rights Expert. Focus on Widerrufsbelehrung (Withdrawal) and consumer protection.
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming withdrawal/return policies are missing, search for:
    - "Widerruf", "Withdrawal", "Return", "Retour", "Refund", "14 Tage", "14 days", "Rückgabe"
    - Also check AGB/Terms pages as these often contain withdrawal info.
    
    STRICT RULES:
    1. Acknowledge Dutch, English, or German versions as VALID.
    2. If links to AGB/Terms/Conditions exist, DO NOT flag consumer info as missing.
    3. Only report if you are 100% certain AND confidence >= 70.
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSection, sourceSnippet, confidence (0-100), verificationNote.`,

    privacy: `You are a Data Privacy Auditor (GDPR/DSGVO).
    
    CRITICAL - VERIFICATION REQUIRED:
    Before claiming privacy policy is missing, search for:
    - "Datenschutz", "Privacy", "Privacybeleid", "Data Protection", "Cookie", "GDPR", "DSGVO"
    - Check footer links, legal pages, and cookie banners.
    
    STRICT RULES:
    1. If Privacy Policy exists in German, English, OR Dutch -> NO ERROR.
    2. Do NOT report "missing contact info in privacy policy" if contact exists elsewhere.
    3. Focus on: existence of policy, cookie consent mechanism, data controller info.
    4. Only report verified issues with confidence >= 70.
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSection, sourceSnippet, confidence (0-100), verificationNote.`,

    ux: `You are a Translation UX Specialist. Focus ONLY on how translation affects user experience.
    
    STRICT RULES:
    1. Report layout breaks caused by text expansion (German text breaking buttons).
    2. Report partial translations (mixed English/German on same UI element).
    3. Report navigation menus that don't switch language correctly.
    4. IGNORE general usability issues (colors, fonts) unless caused by translation.
    
    FOR EACH FINDING include: problem, explanation, recommendation, severity, sourceUrl, sourceSection, sourceSnippet, confidence (0-100), verificationNote.`,

    company: `You are a Business Researcher. Extract Company Name, Industry, HQ, Founded, Size, Revenue, Email, Phone, Key People.
    
    STRICT RULES:
    1. Look at 'legal' pageType pages (Impressum/Colofon) for structured data.
    2. If a field is not CLEARLY visible, state "Not found". DO NOT GUESS.
    3. Extract: VAT ID, Registration Number, Managing Directors, Legal Form.
    4. For contacts: Only include if name and role are explicitly stated.`,

    localization: `You are a German Localization Specialist. Check TRANSLATION STRUCTURE ANALYSIS first.
    
    STRICT RULES:
    1. Machine translation detected -> severity HIGH.
    2. Ignore minor grammar issues. Focus on structural problems (English checkout on German site).
    3. Only report with confidence >= 70.
    
    FOR EACH FINDING include: sourceUrl, sourceSection, sourceSnippet, confidence, verificationNote.`,

    translation: `You are a Translation QA Expert. Detect obvious machine translation artifacts.
    
    Report ONLY if text is clearly:
    - Nonsensical or grammatically broken
    - Wrong language for the page context
    - Obviously auto-translated (unnatural phrasing)
    
    DO NOT report minor grammar issues or stylistic preferences.
    FOR EACH FINDING include: sourceUrl, sourceSection, sourceSnippet, confidence (0-100), verificationNote.`
}


const COMPILER_INSTRUCTION = `You are the Lead Auditor. Combine analyses into a JSON Deep Audit Report.
YOU MUST RESPOND WITH ONLY VALID JSON.

CRITICAL FILTERING RULES:
1. EXCLUDE any finding with confidence < 70 (these are uncertain)
2. EXCLUDE any finding that says "could not verify" or "uncertain"
3. If an agent found that something EXISTS (e.g., "Impressum found"), do NOT include it as a finding
4. Only include VERIFIED ISSUES, not observations

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
  "actionList": ["Action 1", "Action 2"]
}

RULES:
1. EVERY finding MUST have all fields including sourceSection, sourceSnippet, confidence
2. severity MUST be high, medium, or low
3. For companyInfo: If a value is "Not found" or unknown, set it to null or OMIT the key
4. If Machine Translation detected, include "Hire professional translator" in actionList
5. REMOVE findings with confidence < 70 - they should NOT appear in the final report`

// Verification function to filter false positives
// Searches legal pages for terms before reporting as missing
function verifyMissingFindings(report: any, legalPages: any[]): any {
    if (!report?.sections || !Array.isArray(report.sections)) return report

    // Terms that indicate something is present (multi-language)
    const presenceTerms: Record<string, string[]> = {
        'impressum': ['impressum', 'imprint', 'legal notice', 'colofon', 'angaben gemäß', 'verantwortlich', 'legal info'],
        'privacy': ['datenschutz', 'privacy', 'privacybeleid', 'data protection', 'gdpr', 'dsgvo', 'privacyverklaring'],
        'terms': ['agb', 'terms', 'conditions', 'algemene voorwaarden', 'nutzungsbedingungen', 'terms of service'],
        'withdrawal': ['widerruf', 'withdrawal', 'return', 'refund', 'retour', 'rückgabe', '14 tage', '14 days']
    }

    // Build searchable content from legal pages
    const legalContent = legalPages
        .map(p => (p.markdown || '').toLowerCase())
        .join('\n')

    const verifiedSections = report.sections.map((section: any) => {
        if (!section.findings || !Array.isArray(section.findings)) return section

        const verifiedFindings = section.findings.filter((finding: any) => {
            const problem = (finding.problem || '').toLowerCase()

            // Check if this is a "missing" type finding
            const isMissingFinding =
                problem.includes('missing') ||
                problem.includes('not found') ||
                problem.includes('keine') ||
                problem.includes('fehlt') ||
                problem.includes('absent') ||
                problem.includes('no ')

            if (!isMissingFinding) return true  // Keep non-missing findings

            // Determine what item is claimed to be missing
            let foundInContent = false
            for (const [itemType, terms] of Object.entries(presenceTerms)) {
                if (problem.includes(itemType) || terms.some(t => problem.includes(t))) {
                    // Check if any of the terms exist in legal content
                    foundInContent = terms.some(term => legalContent.includes(term))
                    if (foundInContent) {
                        console.log(`[Verification] FALSE POSITIVE: Claimed "${itemType}" missing but found in content`)
                        break
                    }
                }
            }

            // Filter out false positives
            return !foundInContent
        })

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

        // Apply verification to filter false positives
        const legalPages = safeContext.pages.filter((p: any) => p.pageType === 'legal')
        const verified = verifyMissingFindings(parsed, legalPages)
        console.log(`[Verification] Filtered false positives. Before: ${parsed.sections?.reduce((a: number, s: any) => a + (s.findings?.length || 0), 0)} findings, After: ${verified.sections?.reduce((a: number, s: any) => a + (s.findings?.length || 0), 0)} findings`)

        const sections = verified.sections || []
        const totalFindings = sections.reduce((acc: number, s: any) => acc + (s.findings?.length || 0), 0)
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
