import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { findPeople, getRecentPeopleSearches, type PeopleSearchResult } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Search,
    Loader2,
    User,
    ExternalLink,
    History,
    Copy,
    Database,
    AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function FindPeoplePage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<PeopleSearchResult[]>([])

    // Fetch recent searches
    const { data: recentSearches = [] } = useQuery({
        queryKey: ['recentPeopleSearches', user?.id],
        queryFn: () => getRecentPeopleSearches(user!.id),
        enabled: !!user?.id
    })

    // Search mutation
    const searchMutation = useMutation({
        mutationFn: (query: string) => findPeople(query, user!.id),
        onSuccess: (data) => {
            if (data.success) {
                setResults(data.results)
                queryClient.invalidateQueries({ queryKey: ['recentPeopleSearches'] })
                if (data.results.length === 0) {
                    toast.info('No results found for this query.')
                }
            } else {
                toast.error('Search failed: ' + (data as any).error)
            }
        },
        onError: (error: Error) => {
            toast.error('Search failed: ' + error.message)
        }
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        const query = searchQuery.trim()
        setSearchQuery('') // Clear input immediately
        searchMutation.mutate(query)
    }

    const handleRecentClick = (query: string) => {
        setSearchQuery('')
        searchMutation.mutate(query)
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Link copied to clipboard')
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <Search className="h-8 w-8 text-emerald-600" />
                        Find People
                    </h1>
                    <p className="text-muted-foreground mt-2">Search for anyone by name, role, or company.</p>
                </div>
            </div>

            {/* Search Bar */}
            <Card className="border-emerald-100 dark:border-emerald-900 shadow-lg">
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            {!searchQuery && (
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            )}
                            <Input
                                placeholder="e.g. CEO of Google or Marketing Manager at Tesla..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn(
                                    "h-12 text-lg border-emerald-100 focus-visible:ring-emerald-500 transition-all",
                                    !searchQuery ? "pl-10" : "pl-4"
                                )}
                            />
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            disabled={searchMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-8"
                        >
                            {searchMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Results Section */}
                <div className="lg:col-span-4 space-y-6"> {/* Changed to lg:col-span-4 as recent searches moved */}
                    <AnimatePresence mode="wait">
                        {searchMutation.isPending ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800"
                            >
                                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
                                <p className="text-lg font-medium">Scouring the web for matches...</p>
                                <p className="text-sm text-muted-foreground">This uses neural search for precision.</p>
                            </motion.div>
                        ) : results.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <Database className="h-5 w-5 text-emerald-600" />
                                        Found {results.length} Potential Matches
                                    </h2>
                                </div>

                                {results.map((result, idx) => (
                                    <Card key={idx} className="hover:shadow-md transition-shadow group">
                                        <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800/50">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-xl font-bold group-hover:text-emerald-600 transition-colors">
                                                        {result.title}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <User className="h-3.5 w-3.5" />
                                                        <span>{result.author || 'Profile'}</span>
                                                        {result.score && (
                                                            <>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <Badge variant="outline" className="text-[10px] py-0 h-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100">
                                                                    {Math.round(result.score * 100)}% match
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(result.url)}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </a>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-4">
                                            {result.highlights && result.highlights.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key Highlights</p>
                                                    <div className="space-y-3">
                                                        {result.highlights.map((highlight, hIdx) => (
                                                            <div key={hIdx} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-sm italic text-slate-700 dark:text-slate-300 relative overflow-hidden">
                                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30"></div>
                                                                "...{highlight}..."
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {result.text && !result.highlights?.length && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                                    {result.text}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                                                <span className="truncate max-w-[300px]">{result.url}</span>
                                                {result.publishedDate && (
                                                    <span>Updated: {new Date(result.publishedDate).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </motion.div>
                        ) : !searchMutation.isIdle ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-red-200 dark:border-red-900/40"
                            >
                                <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
                                <p className="text-lg font-medium">No direct matches found</p>
                                <p className="text-sm text-muted-foreground">Try broadening your search query.</p>
                                <Button
                                    variant="outline"
                                    className="mt-4"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear Search
                                </Button>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 opacity-50">
                                <User className="h-16 w-16 text-slate-300 mb-4" />
                                <p className="text-lg font-medium text-slate-400 text-center max-w-xs">
                                    Enter a name or role above to start your search.
                                </p>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Recent Searches moved below Results */}
                    {recentSearches.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <History className="h-4 w-4" />
                                Recent Searches
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((search) => (
                                    <Button
                                        key={search.id}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRecentClick(search.query)}
                                        className="rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900 transition-colors"
                                    >
                                        {search.query}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
