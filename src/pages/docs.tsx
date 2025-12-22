import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    BookOpen,
    Search,
    Zap,
    Cpu,
    Target,
    Clock,
    Layers,
    CheckCircle2,
    AlertCircle,
    Share2,
    Download,
    Moon,
    Mail,
    Linkedin,
    Lightbulb
} from 'lucide-react'

export function DocsPage() {
    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
            {/* Top Header with Logo */}
            <header className="px-6 py-8 md:px-10 border-b flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <img src="/logo.svg" alt="YourIntAI Logo" className="h-10 w-10" />
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">User Tutorial Guide</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Business Operations Manual</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">v1.2.0-FINAL</Badge>
            </header>

            {/* Main Content Flow */}
            <main className="flex-1 max-w-4xl mx-auto w-full py-12 px-6 md:px-10 space-y-20 pb-32">

                {/* Intro Section */}
                <section className="space-y-4">
                    <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Mastering YourIntAI</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Welcome to the official YourIntAI tutorial. This guide is designed to help you navigate our ecosystem, troubleshoot common workflow edge cases, and extract the highest quality market intelligence.
                    </p>
                </section>

                {/* SECTION 1: GETTING STARTED */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Mail className="h-6 w-6 text-blue-500" />
                            1. Account & Authentication
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="grid gap-6">
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border space-y-4">
                            <h4 className="font-bold">Email Registration</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Currently, our system strictly supports **Email and Password** account creation. To ensure security, please avoid using third-party social logins if they appear.
                            </p>
                            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Important Note on Email Confirmation:</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-500/80">
                                        After signing up, check your inbox for a confirmation link. If you click the link and see a "Localhost" or "Redirect Error," **don't panic**. The confirmation was successful. Simply close that tab, return to the main login page, and sign in.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 2: AUDIT WORKFLOW */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Zap className="h-6 w-6 text-emerald-500" />
                            2. Running & Managing Audits
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-slate-500">
                                The Core Process
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                To begin, navigate to **"New Analysis"**. Enter the full URL of the website you want to audit. Our system will deploy 8 parallel AI agents to scan for legal compliance and localization quality.
                            </p>
                        </div>

                        {/* Troubleshooting Scenarios */}
                        <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-transparent">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-emerald-600" />
                                    Navigation Tip: Finding "Loading" Audits
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                                <p>
                                    Sometimes, while an audit is still loading, it might not immediately appear in your main "Audit Results" tab.
                                </p>
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border space-y-2">
                                    <p className="font-bold text-xs underline">The Fix:</p>
                                    <ol className="list-decimal pl-4 space-y-2 text-xs">
                                        <li>Go to the **Dashboard**.</li>
                                        <li>Locate the **"Recent Audits"** tab in the center of the screen.</li>
                                        <li>Click the **"View"** button next to your recent project.</li>
                                        <li>If the "View" button is not clickable or doesn't redirect you, it usually means the background process encountered a network timeout. Simply **Retry the Audit** from the New Analysis page.</li>
                                    </ol>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* SECTION 3: KEYWORD SEARCH OPS */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Search className="h-6 w-6 text-amber-500" />
                            3. Advanced Keyword Queries
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="space-y-6">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Our keyword engine is powerful, but it requires precise "prompts" to filter out noise.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 border rounded-2xl space-y-3 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-amber-500" />
                                    <h5 className="font-bold text-sm">Market Targeting</h5>
                                </div>
                                <p className="text-xs text-slate-500">
                                    To find results strictly from a specific country, use the `site:` operator.
                                </p>
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-amber-600">
                                    "marketing agencies site:.nl"
                                </div>
                            </div>
                            <div className="p-5 border rounded-2xl space-y-3 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-amber-500" />
                                    <h5 className="font-bold text-sm">Phrase Matching</h5>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Use quotes to find exact business types or legal terms.
                                </p>
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px] text-amber-600">
                                    "legal counsel for startups" Amsterdam
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 4: FIND PEOPLE */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Linkedin className="h-6 w-6 text-blue-600" />
                            4. Intelligence: Find People
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex gap-4">
                        <div className="shrink-0 p-3 bg-white dark:bg-blue-900 rounded-xl h-fit shadow-sm">
                            <Linkedin className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold">Understanding the Engine</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                The **"Find People"** feature is specialized for professional network extraction. It primarily scans **LinkedIn** and public corporate registries to cross-reference decision-makers. It is most effective when searching for high-level roles (VPs, Directors, Founders).
                            </p>
                        </div>
                    </div>
                </section>

                {/* SECTION 5: AUDIT RESULTS TABS */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <BookOpen className="h-6 w-6 text-slate-500" />
                            5. Navigating Audit Results
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            The **"Audit Results"** page is your archive. It is split into three key tabs for easy management:
                        </p>
                        <div className="grid sm:grid-cols-3 gap-3">
                            {[
                                { label: "Site Audits", desc: "Full website compliance and UX reports." },
                                { label: "Keyword Searches", desc: "History of your previous market queries." },
                                { label: "AI Analysis", desc: "Results from 'Find People' and lead extraction." }
                            ].map((tab, i) => (
                                <div key={i} className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
                                    <h5 className="font-bold text-xs mb-1">{tab.label}</h5>
                                    <p className="text-[10px] text-slate-500">{tab.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 pt-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                <Share2 className="h-4 w-4 text-emerald-500" />
                                Share via Public Link
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                <Download className="h-4 w-4 text-emerald-500" />
                                Download PDF Report
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 6: TECHNICAL LITERACY */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Cpu className="h-6 w-6 text-slate-400" />
                            6. Technical Logic (Simplified)
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-slate-400" />
                                <h4 className="font-bold text-sm">Rate Limiting</h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                To protect your account from being flagged by target servers, we limit you to 5 concurrent audits. This "stealth limit" prevents websites from blocking our IP range.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Layers className="h-5 w-5 text-slate-400" />
                                <h4 className="font-bold text-sm">Concurrency (Speed)</h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Each audit triggers 8 parallel agents simultaneously. This is why we can provide a 50-page deep-audit in under 180 seconds.
                            </p>
                        </div>
                    </div>
                </section>

                {/* SECTION 7: INTERFACE & MODE */}
                <section className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Moon className="h-6 w-6 text-indigo-500" />
                            7. Interface & Visibility
                        </h3>
                        <Separator className="w-full" />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm">Dark Mode Toggle</h4>
                            <p className="text-xs text-slate-500">
                                You can switch between High-Contrast Dark Mode and Traditional Light Mode using the toggle at the bottom of the sidebar.
                            </p>
                        </div>
                        <div className="h-10 w-10 bg-white dark:bg-slate-800 rounded-full border flex items-center justify-center shadow-sm">
                            <Moon className="h-5 w-5 text-indigo-500" />
                        </div>
                    </div>
                </section>

                {/* Closing Status */}
                <section className="pt-12">
                    <div className="p-8 rounded-[2.5rem] border bg-emerald-600 text-white shadow-2xl text-center space-y-4">
                        <CheckCircle2 className="h-10 w-10 text-emerald-200 mx-auto" />
                        <h3 className="text-2xl font-black">All Systems Functional</h3>
                        <p className="text-sm text-emerald-50 max-w-md mx-auto">
                            YourIntAI is currently optimized for international outreach. For any technical support, please contact your account lead.
                        </p>
                    </div>
                </section>

            </main>
        </div>
    )
}
