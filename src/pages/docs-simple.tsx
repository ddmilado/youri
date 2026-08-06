import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Mail,
    Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const quickSteps = [
    {
        icon: Mail,
        title: '1. Sign in',
        text: 'Use your email, or use Google. Done in under a minute.',
    },
    {
        icon: Sparkles,
        title: '2. Start research',
        text: 'Paste a website URL, or describe a market you want to find companies in.',
    },
    {
        icon: CheckCircle2,
        title: '3. Get your result',
        text: 'A report with proof arrives. You open it, read it, and decide what to do next.',
    },
]

const tips = [
    'One URL per line. You can send up to 5 at a time.',
    'For company search: say the country, industry, and size. Example: "B2B SaaS companies in Germany, 20–200 people".',
    'You can close the screen while work runs. The result will still arrive.',
    'Reports can be shared as a link, downloaded as a PDF, or translated to Dutch.',
    'Every finding links to the real website it came from. Click to check it yourself.',
]

const words = [
    { word: 'Audit', meaning: 'A deep look at one website, with a report at the end.' },
    { word: 'Agent', meaning: 'The computer program that browses the web for you.' },
    { word: 'Discovery', meaning: 'Finding new companies that fit a market you describe.' },
    { word: 'Lead', meaning: 'A company you want to contact. Your "people to reach out to" list.' },
    { word: 'Evidence', meaning: 'Proof — the actual page, text, or picture the agent found.' },
    { word: 'Enrich', meaning: 'Add more detail to a lead: location, size, contacts, email.' },
]

export function DocsSimplePage() {
    return (
        <div className="min-h-screen text-foreground">
            <main className="app-page">
                <header className="app-header">
                    <div className="min-w-0">
                        <p className="eyebrow">Documentation · Simple guide</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">YourInt in plain English</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                            This page explains the app in simple words. No technical talk — just what to click and what happens next.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link to="/docs">
                            <Button variant="outline" className="w-full sm:w-auto">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Full guide
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

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">What is this app?</CardTitle>
                                <CardDescription>
                                    YourInt is a research assistant for finding and checking companies.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                                <p>
                                    You give it a job — <strong className="text-foreground">"check this website"</strong> or{' '}
                                    <strong className="text-foreground">"find me companies in Germany"</strong> — and it does the work.
                                </p>
                                <p>
                                    An <strong className="text-foreground">agent</strong> (a program that browses the internet) visits the real websites,
                                    looks at the content, and comes back with a clear report.
                                </p>
                                <p>
                                    The best part: nothing is a guess. Every finding shows you the actual page it came from.
                                    You can check it yourself, and then decide who to contact.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Quick start</CardTitle>
                                <CardDescription>Three steps and you're working.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                {quickSteps.map((step) => (
                                    <div key={step.title} className="rounded-lg border border-border/80 bg-card p-4">
                                        <step.icon className="h-5 w-5 text-secondary" />
                                        <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.text}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">How to check a website</CardTitle>
                                <CardDescription>This is called an audit.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                                <ol className="list-decimal space-y-2 pl-5">
                                    <li>
                                        Go to <strong className="text-foreground">Research</strong> in the menu.
                                    </li>
                                    <li>
                                        Choose <strong className="text-foreground">Website audit</strong>.
                                    </li>
                                    <li>
                                        Paste the website address. One per line. Up to 5 sites.
                                    </li>
                                    <li>
                                        Press <strong className="text-foreground">Start audit</strong>.
                                    </li>
                                    <li>
                                        Watch the progress, or close the window and do something else.
                                    </li>
                                    <li>
                                        When it's done, open the report. It's under <strong className="text-foreground">Results</strong>.
                                    </li>
                                </ol>
                                <p>
                                    The report shows problems (like wrong language or missing legal pages), how serious each
                                    problem is, and what to change. Each problem links to the real page as proof.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">How to find companies</CardTitle>
                                <CardDescription>This is called company discovery.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                                <ol className="list-decimal space-y-2 pl-5">
                                    <li>
                                        Go to <strong className="text-foreground">Research</strong>.
                                    </li>
                                    <li>
                                        Choose <strong className="text-foreground">Company discovery</strong>.
                                    </li>
                                    <li>
                                        Describe your market in normal words. Example:{' '}
                                        <em className="text-foreground">"Cloud software companies in the Netherlands, 50–200 employees"</em>.
                                    </li>
                                    <li>
                                        Press <strong className="text-foreground">Find companies</strong>.
                                    </li>
                                </ol>
                                <p>
                                    You get a list of matching companies with their websites and a short description.
                                    Press <strong className="text-foreground">Analyze</strong> on any of them to run a full
                                    audit of that company's own website.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">How to find people</CardTitle>
                                <CardDescription>When you need a name to contact.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                                <ol className="list-decimal space-y-2 pl-5">
                                    <li>
                                        Go to <strong className="text-foreground">Find people</strong> in the menu.
                                    </li>
                                    <li>
                                        Type a normal question, like <em className="text-foreground">"Head of sales at a logistics company in Hamburg"</em>.
                                    </li>
                                    <li>
                                        Press <strong className="text-foreground">Search</strong>.
                                    </li>
                                </ol>
                                <p>
                                    You see profiles with a match score and short quotes from each profile.
                                    Copy the link or open the profile to check. Your past searches are saved,
                                    so you can run them again anytime.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Leads and email</CardTitle>
                                <CardDescription>What happens after you find a good company.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                                <p>
                                    Good companies go onto your <strong className="text-foreground">Leads</strong> list.
                                    From the Results page, tick the companies you like and press{' '}
                                    <strong className="text-foreground">Add to leads</strong>.
                                </p>
                                <p>
                                    On a lead you can:
                                </p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>
                                        <strong className="text-foreground">Enrich</strong> — add company details, contacts, and emails yourself.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">Email</strong> — get a ready-made first email, built from the audit
                                        report. Open it in your mail app, copy it, or send it.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">Share</strong> — copy a link anyone can open.
                                    </li>
                                </ul>
                                <p>
                                    The email even attaches a link to the report, so the company can see the proof themselves.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6">
                        <div className="surface-panel overflow-hidden">
                            <div className="border-b border-border px-5 py-4">
                                <p className="eyebrow">Little tips</p>
                                <h2 className="mt-1.5 text-sm font-bold">Keep these in mind</h2>
                            </div>
                            <ul className="space-y-3 px-5 py-4 text-sm leading-6 text-muted-foreground">
                                {tips.map((tip) => (
                                    <li key={tip} className="flex gap-2.5">
                                        <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-600" />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="surface-panel overflow-hidden">
                            <div className="border-b border-border px-5 py-4">
                                <p className="eyebrow">Words we use</p>
                                <h2 className="mt-1.5 text-sm font-bold">Mini dictionary</h2>
                            </div>
                            <div className="divide-y divide-border">
                                {words.map((item) => (
                                    <div key={item.word} className="px-5 py-3">
                                        <p className="flex items-center gap-2 text-sm font-semibold">
                                            {item.word}
                                            <Badge variant="outline" className="font-normal">meaning</Badge>
                                        </p>
                                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.meaning}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Link to="/new" className="block">
                            <Button className="w-full justify-between">
                                Ready? Start your first research
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </aside>
                </div>
            </main>
        </div>
    )
}