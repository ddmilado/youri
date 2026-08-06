import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    AlertCircle,
    ArrowUpRight,
    BookOpen,
    Bot,
    CheckCircle2,
    Clock3,
    Cpu,
    Download,
    ExternalLink,
    FileSearch,
    Gauge,
    Lightbulb,
    Link as LinkIcon,
    ListChecks,
    Mail,
    Moon,
    Search,
    Share2,
    Sparkles,
    Target,
    UserPlus,
    Users,
    Wand2,
    Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const contents = [
    { id: 'intro', label: 'What YourInt does' },
    { id: 'start', label: 'Get started' },
    { id: 'dashboard', label: 'Your dashboard' },
    { id: 'research', label: 'Research brief' },
    { id: 'audits', label: 'Website audits' },
    { id: 'reports', label: 'Reading a report' },
    { id: 'discovery', label: 'Company discovery' },
    { id: 'results', label: 'Results & evidence' },
    { id: 'leads', label: 'Build your lead list' },
    { id: 'outreach', label: 'Email outreach' },
    { id: 'people', label: 'Find people' },
    { id: 'background', label: 'Live & background work' },
    { id: 'team', label: 'Team & settings' },
    { id: 'limits', label: 'Limits & good practice' },
]

const workflowCards = [
    {
        icon: LinkIcon,
        title: 'Website audit',
        description: 'Run a deep inspection on one known website, or process up to 5 URLs in a single batch.',
        action: 'Start from Research',
        path: '/new',
    },
    {
        icon: Search,
        title: 'Company discovery',
        description: 'Find companies that match a market by combining industry, geography, and search operators.',
        action: 'Write a search brief',
        path: '/new?type=keyword',
    },
    {
        icon: Users,
        title: 'Find people',
        description: 'Surface decision-makers from professional profiles and public company context.',
        action: 'Search by role',
        path: '/find-people',
    },
]

const queryExamples = [
    {
        label: 'Country targeting',
        value: 'marketing agencies site:.nl',
        note: 'Use site: to focus results on a country or language domain.',
    },
    {
        label: 'Exact phrase',
        value: '"legal counsel for startups" Amsterdam',
        note: 'Use quotes when the phrase must appear together.',
    },
    {
        label: 'Industry + region',
        value: 'B2B SaaS compliance consultants Germany',
        note: 'Combine sector, service, and market for cleaner leads.',
    },
]

function Section({
    id,
    eyebrow,
    title,
    description,
    icon: Icon,
    children,
}: {
    id: string
    eyebrow: string
    title: string
    description: string
    icon: typeof BookOpen
    children: React.ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-24 space-y-5">
            <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="eyebrow">{eyebrow}</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
            </div>
            {children}
        </section>
    )
}

function Step({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4 rounded-lg border border-border/80 bg-card p-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                {number}
            </div>
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
            </div>
        </div>
    )
}

function Callout({
    title,
    children,
    tone = 'info',
}: {
    title: string
    children: React.ReactNode
    tone?: 'info' | 'success' | 'warning'
}) {
    const tones = {
        info: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100',
        icon: 'text-sky-700 dark:text-sky-300',
        success: 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100',
        iconSuccess: 'text-teal-700 dark:text-teal-300',
        warning:
            'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
        iconWarning: 'text-amber-600 dark:text-amber-300',
    }
    const isInfo = tone === 'info'
    const isSuccess = tone === 'success'
    return (
        <div className={`rounded-lg border p-5 ${tones[tone]}`}>
            <div className="flex gap-3">
                {(isSuccess ? <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${tones.iconSuccess}`} /> : <Clock3 className={`mt-0.5 h-5 w-5 shrink-0 ${isInfo ? tones.icon : tones.iconWarning}`} />)}
                <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-90">{children}</p>
                </div>
            </div>
        </div>
    )
}

function ServerList({ items }: { items: Array<{ label: string; value: string }> }) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
            {items.map((item, index) => (
                <div
                    key={item.label}
                    className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                        index > 0 ? 'border-t border-border' : ''
                    }`}
                >
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                </div>
            ))}
        </div>
    )
}

export function DocsPage() {
    return (
        <div className="min-h-screen text-foreground">
            <main className="app-page">
                <header className="app-header">
                    <div className="min-w-0">
                        <p className="eyebrow">Documentation</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">YourInt Guide</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                            Everything you need to know to research markets, audit websites, and build an evidence-backed
                            list of opportunities — from your first sign-in to your first outreach email.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link to="/docs/simple">
                            <Button className="w-full sm:w-auto" variant="outline">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Simple guide
                            </Button>
                        </Link>
                        <Link to="/new">
                            <Button className="w-full sm:w-auto">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Start research
                            </Button>
                        </Link>
                    </div>
                </header>

                <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
                    <aside className="hidden lg:block">
                        <div className="sticky top-8 space-y-4">
                            <div className="surface-panel p-4">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white dark:bg-slate-950">
                                        <img src="/logo.svg" alt="YourIntAI Logo" className="h-7 w-7 object-contain" />
                                    </div>
                                    <div>
                                        <p className="font-semibold leading-tight">On this page</p>
                                        <p className="text-xs text-muted-foreground">Full user guide</p>
                                    </div>
                                </div>
                                <nav className="mt-5 max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                                    {contents.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            {item.label}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p className="text-xs leading-5">
                                        If an email confirmation opens a localhost error page, return to login and sign in — the confirmation may already be complete.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className="space-y-12">
                        <section className="grid gap-4 md:grid-cols-3">
                            {workflowCards.map((card) => (
                                <Card key={card.title} className="overflow-hidden transition-shadow hover:shadow-md">
                                    <CardHeader>
                                        <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-secondary">
                                            <card.icon className="h-5 w-5" />
                                        </div>
                                        <CardTitle className="text-lg">{card.title}</CardTitle>
                                        <CardDescription>{card.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Link to={card.path}>
                                            <Badge variant="outline" className="gap-1">
                                                {card.action}
                                                <ArrowUpRight className="h-3 w-3" />
                                            </Badge>
                                        </Link>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>

                        <Section
                            id="intro"
                            eyebrow="Overview"
                            title="What YourInt does"
                            description="YourInt is a research workspace for sales and market intelligence. It sends an AI browser agent to the real, live web, has it collect verifiable evidence, and turns that evidence into reports, leads, and outreach emails."
                            icon={Bot}
                        >
                            <div className="grid gap-4 md:grid-cols-3">
                                <Step number="1" title="Audit websites">
                                    Ask an agent to open a real browser and inspect a website, its key journeys, localization, and conversion signals. Every finding is backed by a source URL, a snippet, and a screenshot.
                                </Step>
                                <Step number="2" title="Discover companies">
                                    Give the agent a market brief — industry, region, size, anything that matters — and it returns a verified list of matching companies with real websites.
                                </Step>
                                <Step number="3" title="Turn results into outreach">
                                    Promote the best results to a lead list, enrich them with company details and key people, and generate a ready-to-send cold-outreach email with the evidence attached.
                                </Step>
                            </div>
                            <Callout tone="info" title="Everything is evidence-backed">
                                Findings are not guesses. Each report brings the source URL, the exact page section, a text snippet, and a confidence percentage. You can follow the trail from a claim back to the live website at any time.
                            </Callout>
                        </Section>

                        <Section
                            id="start"
                            eyebrow="01 · Setup"
                            title="Get started"
                            description="From your first sign-in, you are ready to run research. There is nothing to install and nothing to configure."
                            icon={Mail}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Create your account">
                                    Sign up with email and password, or click Let's Go with Google. If you sign up with an email, open the confirmation message and click the link, then return to the sign-in screen.
                                </Step>
                                <Step number="2" title="Pick your first workflow">
                                    Start a website audit, write a company-discovery brief, or search for people — three doors into the same evidence workspace. Most users begin with an audit.
                                </Step>
                                <Step number="3" title="Prefer a magic link?">
                                    On the sign-in screen, enter your email and click Magic Link. You'll get an email that signs you straight in — no password needed.
                                </Step>
                                <Step number="4" title="Sign out safely">
                                    Use the sign-out button on the sidebar. Every protected page will ask you to sign in again before showing your data.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="dashboard"
                            eyebrow="02 · Home"
                            title="Your dashboard"
                            description="A single starting point: what is running, what is done, and what you can do next."
                            icon={Gauge}
                        >
                            <ServerList
                                items={[
                                    { label: 'Summary metrics', value: 'Total research runs, jobs in progress, completed evidence, and saved leads' },
                                    { label: 'Recent research', value: 'Your latest audits and searches, with a checkbox to promote results to leads' },
                                    { label: 'Agent activity', value: 'Shows whether an agent is browsing now, and a button to follow the active run' },
                                    { label: 'Start with a question', value: 'Quick links to audit a website, find companies, or find decision-makers' },
                                    { label: 'Recent discovery work', value: 'Shortcuts into your keyword searches and your people searches' },
                                ]}
                            />
                            <Callout tone="success" title="Two panels, two habits">
                                Use the dashboard for a glance and a quick launch. Use the Research page when you are ready to submit a brief — that is where all new work begins.
                            </Callout>
                        </Section>

                        <Section
                            id="research"
                            eyebrow="03 · Starting point"
                            title="The Research brief"
                            description="Every piece of new work starts here. Choose a method, describe the target, and press one button. Your agent continues on a secure worker and returns its results to this workspace."
                            icon={Sparkles}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Website audit">
                                    Choose Website audit for a known site — your own, a competitor's, or a client's. Inspects content, UX, trust, and conversion signals with a real browser.
                                </Step>
                                <Step number="2" title="Company discovery">
                                    Choose Company discovery for a market. Example brief: B2B cybersecurity companies in Germany serving manufacturers, 20–200 employees.
                                </Step>
                                <Step number="3" title="Submit once, follow live">
                                    The submission opens a processing panel with live status. You can watch it or minimize it to the background tray.
                                </Step>
                                <Step number="4" title="Results are saved">
                                    Every run stays in your Results page history, so you never lose a finished audit or search.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="audits"
                            eyebrow="04 · Researcher"
                            title="Run a website audit"
                            description="Audits inspect websites for legal compliance, localization quality, UX and conversion trust killers, plus sales context. You can run one URL or a small batch."
                            icon={Zap}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Audit flow</CardTitle>
                                    <CardDescription>What happens after you press Start audit.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-3">
                                    <Step number="1" title="Submit URLs">
                                        Paste one URL per line on the Research page. Batches support up to 5 URLs. The counter turns red if you exceed the cap.
                                    </Step>
                                    <Step number="2" title="Monitor live status">
                                        The processing panel shows the agent preparing a browser session, navigating, inspecting, and collecting evidence. Minimize it any time.
                                    </Step>
                                    <Step number="3" title="Review the report">
                                        Completed audits appear on the dashboard and under Research results. Open the report to read the evidence and the action plan.
                                    </Step>
                                </CardContent>
                            </Card>
                            <Callout tone="info" title="The agent works in the background">
                                Minimize an active audit or a keyword search and keep working. The floating task tray keeps each job visible while it runs — audits run on the VPS, not in your browser tab.
                            </Callout>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <ListChecks className="h-4 w-4 text-secondary" />
                                        Audit focus areas
                                    </h3>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                        <li>Linguistic and localization errors</li>
                                        <li>Legal & trust readiness (impressum, terms, consumer rights)</li>
                                        <li>Shipping, returns and checkout clarity</li>
                                        <li>UX and conversion trust killers</li>
                                        <li>Executive summary and company context</li>
                                    </ul>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Clock3 className="h-4 w-4 text-secondary" />
                                        Audit statuses
                                    </h3>
                                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                                        <li><Badge className="bg-foreground/10 text-foreground">pending</Badge> queued, waiting to start</li>
                                        <li><Badge className="bg-sky-500/15 text-sky-600">processing</Badge> agent is browsing now</li>
                                        <li><Badge className="bg-emerald-500/15 text-emerald-600">completed</Badge> report is ready to open</li>
                                        <li><Badge className="bg-red-500/15 text-red-600">failed</Badge> something went wrong — check the task tray</li>
                                    </ul>
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="reports"
                            eyebrow="05 · The report"
                            title="Read an audit report"
                            description="Every audit produces four layers of value: the bottom line score, the recommended next steps, the detailed findings, and the proof behind each one."
                            icon={BookOpen}
                        >
                            <ServerList
                                items={[
                                    { label: 'Audit score', value: 'A 0–100 score computed from severity and volume of findings' },
                                    { label: 'Risks at a glance', value: 'Critical issues, key findings, and localization signals in a summary row' },
                                    { label: 'Detailed findings', value: 'Issues sorted by severity, each with an analysis, recommendation, source URL, snippet, and confidence' },
                                    { label: 'Action plan', value: 'An editable-looking checklist of your prioritized next steps' },
                                    { label: 'Company profile', value: 'Industry, location, size, revenue, contacts — and key people when found' },
                                    { label: 'Browser evidence', value: 'The agent trace and up to four evidence screenshots you can open separately' },
                                ]}
                            />
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Share2 className="h-4 w-4 text-secondary" />
                                        Share a report
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Click Share to make the report public and copy its link. Anyone with the link can read it — for clients, reviewers, or handoff.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Download className="h-4 w-4 text-secondary" />
                                        Export
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Use the export button to download a nicely formatted PDF of the report, or the language toggle to generate a Dutch version on demand.
                                    </p>
                                </div>
                            </div>
                            <Callout tone="success" title="Evidence is clickable">
                                Each finding links out to the real page it comes from. Hover a source URL, open the section link, or view the screenshot directly from the finding.
                            </Callout>
                        </Section>

                        <Section
                            id="discovery"
                            eyebrow="06 · Discovery"
                            title="Company discovery"
                            description="Replace manual lists with a verified, structured set of candidate companies. The more specific your brief, the sharper the list."
                            icon={Target}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">What lands in a search brief</CardTitle>
                                    <CardDescription>Including the right context produces cleaner results.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-3">
                                    {queryExamples.map((example) => (
                                        <div key={example.label} className="rounded-lg border border-border/80 bg-card p-4">
                                            <div className="flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-amber-500" />
                                                <h3 className="text-sm font-semibold">{example.label}</h3>
                                            </div>
                                            <code className="mt-3 block rounded-md bg-muted p-3 text-xs font-semibold text-foreground">
                                                {example.value}
                                            </code>
                                            <p className="mt-3 text-xs leading-5 text-muted-foreground">{example.note}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Write the brief">
                                    Mention industry, location, company size, exclusions, or search operators. Example: 'sustainable packaging manufacturers site:.de with 50–250 employees'.
                                </Step>
                                <Step number="2" title="Results arrive as finds">
                                    Discovered companies appear under Research & Keyword Searches as New. Every result is verified against its own website before it reaches you.
                                </Step>
                                <Step number="3" title="Analyze the interesting ones">
                                    Press Analyze on any result — or batch Analyze Selected (up to five) — to run a full deep audit on that company's own website.
                                </Step>
                                <Step number="4" title="Promote to leads">
                                    The best companies earn their place in your pipeline. Add them to leads in one click and enrich them later.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="results"
                            eyebrow="07 · Evidence library"
                            title="Results & evidence"
                            description="Your Research & Report page is the evidence library: one tab for completed audits, one for keyword search results."
                            icon={FileSearch}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <h3 className="text-sm font-semibold">Site Audits tab</h3>
                                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        <li>· Each row shows the audit title, who ran it, URL, status, issue count, and date.</li>
                                        <li>· Use the share icon to toggle a public report and copy its link.</li>
                                        <li>· Select rows and delete in bulk, or promote them to leads.</li>
                                        <li>· Open any completed audit with the arrow button.</li>
                                    </ul>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="text-sm font-semibold">Keyword searches tab</h3>
                                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        <li>· Companies returned by your search briefs appear as New or Analyzed.</li>
                                        <li>· The analyze button runs a full audit of a company's own website.</li>
                                        <li>· The Analyze Selected batch runs up to 5 audits at once.</li>
                                        <li>· Search history is kept so you can revisit and compare.</li>
                                    </ul>
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="leads"
                            eyebrow="08 · Pipeline"
                            title="Your lead list"
                            description="Leads are the promising companies you chose to track. They move through your pipeline and become the starting point for outreach."
                            icon={Users}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Lead statuses</CardTitle>
                                    <CardDescription>Follow each lead from first discovery to a won deal.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-5">
                                    <Step number="1" title="New">A discovery just arrived in your pipeline.</Step>
                                    <Step number="2" title="Contacted">You sent or drafted an outreach email.</Step>
                                    <Step number="3" title="Qualified">A strong fit — worth real outreach time.</Step>
                                    <Step number="4" title="Won">Closed. Use it as reference material.</Step>
                                    <Step number="5" title="Lost">Not a fit — keep the audit for later.</Step>
                                </CardContent>
                            </Card>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Add a lead">
                                    On the dashboard or in the Research & Report page, select one or more results and choose Add to leads. Each becomes a lead at status New.
                                </Step>
                                <Step number="2" title="Open a lead">
                                    Click View on any lead to open its card — a company profile, key contacts, and a shortcut to its audit report.
                                </Step>
                                <Step number="3" title="Enrich a lead">
                                    Use Enrich to fill in industry, location, size, revenue, company email and phone, plus add multiple people with titles, emails, and LinkedIn profiles.
                                </Step>
                                <Step number="4" title="Keep the evidence attached">
                                    If the lead came from a report, the report stays linked. Enrich can even update the source audit, so everything stays in sync.
                                </Step>
                                <Step number="5" title="Share a lead">
                                    The share button copies a link to the lead. Anyone with the link can view it, even without an account.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="outreach"
                            eyebrow="09 · Outreach"
                            title="Email outreach"
                            description="Generate a first cold email directly inside the workspace — built from the audit's strongest finding, with the contact the audit identified."
                            icon={Mail}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Wand2 className="h-4 w-4 text-secondary" />
                                        Open the genie
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        On a lead, click Email. We build the To field from the strongest contact known, and a subject + body on the most important problem the audit found — with a calm, human tone.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Share2 className="h-4 w-4 text-secondary" />
                                        It ships it
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Open your mailbox, copy the body and subject, or send the default draft and let your mail app compose the rest. The evidence link points back to the report, so your contact can see the proof themselves.
                                    </p>
                                </div>
                            </div>
                            <Callout tone="info" title="Before you hit send">
                                The email references the audit report. If the report is still private, you will be asked to make it public first — just confirm. Opening the email also marks the lead as Contacted automatically.
                            </Callout>
                        </Section>

                        <Section
                            id="people"
                            eyebrow="10 · People"
                            title="Find people"
                            description="When your opportunity needs a name, search for it by role, company, and location."
                            icon={Target}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Write a natural query">
                                    'CEO of Google', 'Marketing Manager at Tesla', 'Head of strategy in Berlin'. Plain sentences work better than comma lists.
                                </Step>
                                <Step number="2" title="Judge by the highlights">
                                    Each result shows a match strength and a few pull-quotes from the profile. Judge relevance on role, geography, and company context.
                                </Step>
                                <Step number="3" title="Capture links">
                                    Copy the profile link straight from the result, or open it in a new tab to verify before outreach.
                                </Step>
                                <Step number="4" title="Re-run old searches">
                                    Your recent searches are saved as chips — one click re-runs an old query when the world changes.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="background"
                            eyebrow="11 · Long-running work"
                            title="Live progress & background tasks"
                            description="Research runs are monitored like app tasks — the progress shows you what the agent is doing, and when it's done."
                            icon={Clock3}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="The processing panel">
                                    When you submit, a live panel follows the agent step-by-step: brief received — browser session — evidence review — results structured.
                                </Step>
                                <Step number="2" title="The task tray">
                                    Minimize anything and a pill in the corner shows how many jobs are running. Click it to see each task, its live status, and progress.
                                </Step>
                                <Step number="3" title="Open the result in two clicks">
                                    Completed tasks in the tray link straight to the report or to the keyword results. One click, no searching.
                                </Step>
                                <Step number="4" title="Batch runs stay separate">
                                    When you submit two or more audits at once, each one becomes an independent job in the tray with its own URL and status — you can track them all in one place.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="team"
                            eyebrow="12 · Admin"
                            title="Team & settings"
                            description="A little configuration goes a long way when you collaborate or when you need a personal touch."
                            icon={UserPlus}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="text-sm font-semibold">Profile</h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Your email is fixed. Your display name appears on audits and in the sidebar. Change it anytime from Settings — it is saved instantly.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="text-sm font-semibold">Team members</h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Add teammates by email and they can join the audits and leads you run. You stay in control of deletes and ownership.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="text-sm font-semibold">Security</h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Change your password or manage API keys from Settings. Your workspace access controls keep reports and leads protected.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-card p-4">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                                        <Moon className="h-4 w-4 text-secondary" />
                                        Theme
                                    </h3>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Toggle light, dark, or system theme from the sidebar — your choice sticks.
                                    </p>
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="limits"
                            eyebrow="13 · Fine print"
                            title="Limits & good practice"
                            description="A few operational constraints keep research stable and make long-running work easier to manage."
                            icon={Cpu}
                        >
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">Batch size</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Run up to 5 URLs per audit batch, and up to 5 keyword companies per Analyze selection.</p>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">One short</p>
                                    <p className="mt-2 text-sm text-muted-foreground">A run keeps working even after you close the browser tab — it only lives in this workspace.</p>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">Evidence first</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Keep findings you act on to the reports. Extract a source snippet when you quote it — and a lead if you follow up.</p>
                                </div>
                            </div>
                            <Callout tone="success" title="You are ready">
                                The loop is simple: run an audit, check the evidence, promote only what holds, enrich, enrich, email. Open Research, start your first brief, and the agent will do the looking while you work.
                            </Callout>
                        </Section>

                        <section className="rounded-lg border border-teal-200 bg-teal-50 p-6 text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                                    <div>
                                        <h2 className="text-xl font-bold">Ready to research?</h2>
                                        <p className="mt-1 text-sm leading-6 text-teal-800 dark:text-teal-200">
                                            You now have the full loop: run an audit, read the evidence, promote the winners to leads, and reach out with a proven first email.
                                        </p>
                                    </div>
                                </div>
                                <Link to="/new">
                                    <Button className="w-full bg-teal-700 text-white hover:bg-teal-800 md:w-auto">
                                        Start
                                        <ExternalLink className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    )
}