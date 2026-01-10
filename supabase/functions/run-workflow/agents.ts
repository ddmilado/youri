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

// Agent Instructions
const AGENT_INSTRUCTIONS = {
    legal: `You are a German & EU Legal Specialist. Focus on Impressum (Imprint), AGB (Terms), and GDPR. 
    IMPORTANT: If legal documents exist in any language (German, English, or Dutch), acknowledge them as present. DO NOT say they don't exist if you found a version in at least one of these languages.
    For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    consumer: `You are a Consumer Rights Expert. Focus on Widerrufsbelehrung (Withdrawal) and Shipping. 
    Acknowledge Dutch or English versions as valid.
    For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    privacy: `You are a Data Privacy Auditor (GDPR/DSGVO). Check for Privacy Policies in German, English, or Dutch.
    If a policy exists in any of these languages, it is considered present.
    For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    ux: `You are a Conversion Expert. Focus on usability and trust signals. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    company: `You are a Business Researcher. Extract Company Name, Industry, HQ, Founded, Size, Revenue, Email, Phone, Key People.
    PRIORITY: Look at 'legal' pageType pages (Impressum/Colofon) for structured data:
    - VAT ID (USt-IdNr / BTW-nummer)
    - Registration Number (HRB/HRA/KvK)
    - Managing Directors (Geschäftsführer / Bestuurders)
    - Legal Form (GmbH, AG, BV, etc.)`,
    localization: `You are a German Localization Specialist. Check TRANSLATION STRUCTURE ANALYSIS first. For Machine Translation or Client-Side widgets, severity is HIGH. Include sourceUrl and verificationNote.`,
    seo: `You are a Technical SEO Specialist. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    trust: `You are a Trust Auditor. Focus on social proof and credibility. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    checkout: `You are a Checkout Specialist. Focus on payment transparency. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    price: `You are a Price Transparency Auditor. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl, verificationNote.`,
    translation: `You are a Translation QA Expert. Analyze 3-5 text samples for machine translation artifacts. For each issue: Problem, Explanation, Recommendation, Severity, sourceUrl.`
}

const COMPILER_INSTRUCTION = `You are the Lead Auditor. Combine analyses into a JSON Deep Audit Report.
YOU MUST RESPOND WITH ONLY VALID JSON.
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
  "sections": [{ "title": "...", "findings": [{ "problem": "...", "explanation": "...", "recommendation": "...", "severity": "high|medium|low", "sourceUrl": "...", "verificationNote": "..." }] }],
  "conclusion": "...",
  "actionList": ["Action 1", "Action 2"]
}
RULES:
1. EVERY finding MUST have all fields
2. severity MUST be high, medium, or low
3. Start with { and end with }
4. If Machine Translation detected, include "Hire professional translator" in actionList`

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
    // Smart context truncation
    // OPTIMIZATION: Reduced from 150k to 60k to prevent hitting OpenAI TPM limits with 11 parallel agents.
    const contextLimit = 60000
    const safeContext: any = {
        translationStructure: fullData?.translationStructure || "Not available",
        company: fullData?.company || {},
        contact: fullData?.contact || {},
        pages: []
    }

    let currentLength = JSON.stringify(safeContext).length
    const sourcePages = Array.isArray(fullData?.pages) ? fullData.pages : []

    for (const page of sourcePages) {
        const pSize = (page.markdown?.length || 0)
        if (currentLength + pSize + 200 > contextLimit) break
        safeContext.pages.push(page)
        currentLength += pSize + 50
    }

    const contextString = JSON.stringify(safeContext, null, 2)
    const baseContext = `Analyze this website: ${url}\n\n[CONTEXT START]\n${contextString}\n[CONTEXT END]`

    let res1, res2, res3, res4, res5, res6, res7, res8, res9, res10, res11

    if (cachedData) {
        await updateStatus('Restoring previous agent findings...')
        res1 = cachedData.legal; res2 = cachedData.consumer; res3 = cachedData.privacy
        res4 = cachedData.ux; res5 = cachedData.company; res6 = cachedData.localization
        res7 = cachedData.seo; res8 = cachedData.trust; res9 = cachedData.checkout
        res10 = cachedData.price; res11 = cachedData.translationQuality
    } else {
        await updateStatus('Deploying 11 AI Auditor Agents...')

        await updateStatus('Deploying ALL 11 AI Auditor Agents (Parallel Swarm)...')

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
            while (agentsFinished < 11) {
                await updateStatus(`Audit Swarm Analyzing: ${agentsFinished}/11 Agents Complete...`)
                await new Promise(r => setTimeout(r, 1500))
            }
        }

        // Execute ALL agents in parallel to maximize speed within the wall-clock limit
        const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11] = await Promise.all([
            callAgent(AGENT_INSTRUCTIONS.legal, 'Legal'),
            callAgent(AGENT_INSTRUCTIONS.consumer, 'Consumer'),
            callAgent(AGENT_INSTRUCTIONS.privacy, 'Privacy'),
            callAgent(AGENT_INSTRUCTIONS.ux, 'UX'),
            callAgent(AGENT_INSTRUCTIONS.company, 'Company'),
            callAgent(AGENT_INSTRUCTIONS.localization, 'Localization'),
            callAgent(AGENT_INSTRUCTIONS.seo, 'SEO'),
            callAgent(AGENT_INSTRUCTIONS.trust, 'Trust'),
            callAgent(AGENT_INSTRUCTIONS.checkout, 'Checkout'),
            callAgent(AGENT_INSTRUCTIONS.price, 'Price'),
            callAgent(AGENT_INSTRUCTIONS.translation, 'Translation'),
            updateProgress()
        ])

        // Map results variables
        res1 = r1; res2 = r2; res3 = r3; res4 = r4; res5 = r5
        res6 = r6; res7 = r7; res8 = r8; res9 = r9; res10 = r10; res11 = r11
    }

    const allAgentData = {
        legal: res1, consumer: res2, privacy: res3, ux: res4, company: res5,
        localization: res6, seo: res7, trust: res8, checkout: res9, price: res10, translationQuality: res11
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
        { role: 'assistant', content: `SEO: ${truncate(safeRes(res7))}` },
        { role: 'assistant', content: `Trust: ${truncate(safeRes(res8))}` },
        { role: 'assistant', content: `Checkout: ${truncate(safeRes(res9))}` },
        { role: 'assistant', content: `Price: ${truncate(safeRes(res10))}` },
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

        const sections = parsed.sections || []
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

        return { ...parsed, issuesCount: totalFindings, score: calculatedScore }
    } catch (e) {
        console.error('Failed to parse report:', e)
        throw new Error(`Failed to generate report: ${(e as Error).message}`)
    }
}
