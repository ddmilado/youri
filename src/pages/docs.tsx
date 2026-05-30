import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    AlertCircle,
    ArrowUpRight,
    BookOpen,
    CheckCircle2,
    Clock3,
    Cpu,
    Download,
    ExternalLink,
    Lightbulb,
    Link as LinkIcon,
    Mail,
    Moon,
    Search,
    Share2,
    Sparkles,
    Target,
    Users,
    Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const contents = [
    { id: 'start', label: 'Get Started' },
    { id: 'audits', label: 'Audits' },
    { id: 'search', label: 'Keyword Search' },
    { id: 'people', label: 'Find People' },
    { id: 'results', label: 'Results' },
    { id: 'limits', label: 'Limits' },
]

const workflowCards = [
    {
        icon: LinkIcon,
        title: 'URL Analysis',
        description: 'Run a deep inspection on one known company, or process up to 5 URLs in a batch.',
        action: 'Start from New Analysis',
    },
    {
        icon: Search,
        title: 'Keyword Search',
        description: 'Find new companies by combining industry, geography, and search operators.',
        action: 'Use precise queries',
    },
    {
        icon: Users,
        title: 'Find People',
        description: 'Surface decision-makers from professional profiles and public company context.',
        action: 'Search by role',
    },
]

const queryExamples = [
    {
        label: 'Country targeting',
        value: 'marketing agencies site:.nl',
        note: 'Use site: to focus results on a country domain.',
    },
    {
        label: 'Exact phrase',
        value: '"legal counsel for startups" Amsterdam',
        note: 'Use quotes when the phrase must appear together.',
    },
    {
        label: 'Industry plus region',
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

export function DocsPage() {
    return (
        <div className="min-h-screen text-foreground">
            <main className="app-page">
                <header className="app-header">
                    <div className="min-w-0">
                        <p className="eyebrow">Documentation</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">YourIntAI Guide</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                            A practical operating guide for audits, search workflows, team handoff, and troubleshooting.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link to="/new">
                            <Button className="w-full sm:w-auto">
                                <Sparkles className="mr-2 h-4 w-4" />
                                New Analysis
                            </Button>
                        </Link>
                        <Link to="/dashboard">
                            <Button variant="outline" className="w-full sm:w-auto">
                                Dashboard
                                <ArrowUpRight className="ml-2 h-4 w-4" />
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
                                        <p className="font-semibold leading-tight">Docs</p>
                                        <p className="text-xs text-muted-foreground">Updated guide</p>
                                    </div>
                                </div>
                                <nav className="mt-5 space-y-1">
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
                                        If an email confirmation opens a localhost error page, return to login and sign in. The confirmation may already be complete.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className="space-y-12">
                        <section className="grid gap-4 md:grid-cols-3">
                            {workflowCards.map((card) => (
                                <Card key={card.title} className="overflow-hidden">
                                    <CardHeader>
                                        <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-secondary">
                                            <card.icon className="h-5 w-5" />
                                        </div>
                                        <CardTitle className="text-lg">{card.title}</CardTitle>
                                        <CardDescription>{card.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant="outline">{card.action}</Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>

                        <Section
                            id="start"
                            eyebrow="01"
                            title="Get Started"
                            description="Use email authentication to enter the workspace, then start from the Dashboard or New Analysis page depending on your task."
                            icon={Mail}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Create or access your account">
                                    Sign up with email and password, confirm your email if prompted, then return to the login screen.
                                </Step>
                                <Step number="2" title="Choose your first workflow">
                                    Use New Analysis for audits and keyword discovery, or use Leads to review companies already promoted from audits.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="audits"
                            eyebrow="02"
                            title="Run and Manage Audits"
                            description="Audits inspect websites for compliance, localization, and sales context. You can run one URL or a small batch."
                            icon={Zap}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Audit Flow</CardTitle>
                                    <CardDescription>What happens after you submit a URL.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-3">
                                    <Step number="1" title="Submit URL">Paste one URL per line on New Analysis. Batches support up to 5 URLs.</Step>
                                    <Step number="2" title="Monitor progress">The processing overlay shows live status while the audit runs.</Step>
                                    <Step number="3" title="Review report">Completed audits appear on the Dashboard and in Audit Results.</Step>
                                </CardContent>
                            </Card>
                            <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/50 dark:bg-sky-950/30">
                                <div className="flex gap-3">
                                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
                                    <div>
                                        <p className="font-semibold text-sky-950 dark:text-sky-100">Background tasks</p>
                                        <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-200">
                                            Minimize an active audit or keyword search to keep working. The floating task tray keeps the job visible while it runs.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="search"
                            eyebrow="03"
                            title="Write Better Keyword Queries"
                            description="Precise search language produces better company lists. Combine industry, location, role, and domain operators."
                            icon={Target}
                        >
                            <div className="grid gap-4 md:grid-cols-3">
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
                            </div>
                        </Section>

                        <Section
                            id="people"
                            eyebrow="04"
                            title="Find People"
                            description="Use people search when you need decision-makers attached to a company, market, or role."
                            icon={Users}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Step number="1" title="Search for senior roles">
                                    Founder, VP, Head of, Director, and Operations roles tend to be the most useful targets.
                                </Step>
                                <Step number="2" title="Cross-check context">
                                    Use company names, locations, and public profile snippets to decide whether a contact is relevant.
                                </Step>
                            </div>
                        </Section>

                        <Section
                            id="results"
                            eyebrow="05"
                            title="Use Results and Reports"
                            description="Audit Results stores completed reports and keyword search history, while Leads stores opportunities you want to track."
                            icon={BookOpen}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Share2 className="h-5 w-5 text-secondary" />
                                            Share
                                        </CardTitle>
                                        <CardDescription>Create public links for handoff, review, or client-facing follow-up.</CardDescription>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Download className="h-5 w-5 text-secondary" />
                                            Export
                                        </CardTitle>
                                        <CardDescription>Download reports when you need an offline snapshot of the audit.</CardDescription>
                                    </CardHeader>
                                </Card>
                            </div>
                        </Section>

                        <Section
                            id="limits"
                            eyebrow="06"
                            title="Limits and Interface"
                            description="A few operational constraints keep the platform stable and make long-running work easier to manage."
                            icon={Cpu}
                        >
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">Batch size</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Run up to 5 URLs per audit batch.</p>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">Task visibility</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Minimized work stays available in the floating task tray.</p>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-4">
                                    <p className="text-sm font-semibold">Theme</p>
                                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                        <Moon className="h-4 w-4" />
                                        Toggle light or dark mode from the sidebar.
                                    </p>
                                </div>
                            </div>
                        </Section>

                        <section className="rounded-lg border border-teal-200 bg-teal-50 p-6 text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                                    <div>
                                        <h2 className="text-xl font-bold">Ready to Work</h2>
                                        <p className="mt-1 text-sm leading-6 text-teal-800 dark:text-teal-200">
                                            You now have the core workflows: run audits, search markets, find contacts, and convert useful results into leads.
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
