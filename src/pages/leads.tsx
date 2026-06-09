import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, Mail, Share2, Trash2, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getLeads, deleteProjectLeads } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from '@/components/ui/checkbox'

const StatusBadge = ({ status }: { status: string }) => {
    let colorClass = "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700"
    if (status === 'won') colorClass = "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-800"
    else if (status === 'new') colorClass = "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800"
    else if (status === 'qualified') colorClass = "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800"
    else if (status === 'contacted') colorClass = "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800"
    else if (status === 'lost') colorClass = "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800"

    const label = status.charAt(0).toUpperCase() + status.slice(1)

    return (
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border w-fit ${colorClass}`}>
            <span className="font-semibold text-xs">{label}</span>
        </div>
    )
}



// ... (imports remain)

export function LeadsPage() {
    const queryClient = useQueryClient()
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
    const [isDeleting, setIsDeleting] = useState(false)

    // Dialog State removed

    const { data: leads, isLoading } = useQuery({
        queryKey: ['leads'],
        queryFn: getLeads,
    })

    const handleDelete = async () => {
        if (selectedLeadIds.length === 0) return

        if (!confirm('Are you sure you want to delete these leads?')) return

        setIsDeleting(true)
        try {
            await deleteProjectLeads(selectedLeadIds)
            toast.success('Leads deleted')
            setSelectedLeadIds([])
            queryClient.invalidateQueries({ queryKey: ['leads'] })
        } catch (error) {
            toast.error('Failed to delete leads')
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="app-page">
            <header className="app-header">
                <div>
                    <p className="eyebrow">Pipeline</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Leads</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Review companies promoted from audits and share opportunities with the team.
                    </p>
                </div>
                <div className="surface-panel flex w-full items-center gap-3 p-3 md:w-auto">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary/10 text-secondary">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold leading-none">{leads?.length || 0}</p>
                        <p className="text-xs font-medium text-muted-foreground">Total leads</p>
                    </div>
                </div>
            </header>

            <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-4 border-b border-border/80 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1.5">
                        <CardTitle>All Leads</CardTitle>
                        <CardDescription>View and manage leads identified from audits.</CardDescription>
                    </div>

                    {selectedLeadIds.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={handleDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete ({selectedLeadIds.length})
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={leads && leads.length > 0 && selectedLeadIds.length === leads.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedLeadIds(leads?.map(l => l.id) || [])
                                            } else {
                                                setSelectedLeadIds([])
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Company / Title</TableHead>
                                <TableHead>URL</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Creator</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : leads && leads.length > 0 ? (
                                leads.map((lead) => (
                                    <TableRow key={lead.id} className={selectedLeadIds.includes(lead.id) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedLeadIds.includes(lead.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedLeadIds(prev => [...prev, lead.id])
                                                    } else {
                                                        setSelectedLeadIds(prev => prev.filter(id => id !== lead.id))
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[180px] font-semibold">
                                            {lead.company_name || lead.title}
                                        </TableCell>
                                        <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                                            <a href={lead.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                                                {lead.url}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={lead.status} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{lead.creator_name || 'Team Member'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => {
                                                        const url = `${window.location.origin}/leads/${lead.id}`
                                                        navigator.clipboard.writeText(url)
                                                        toast.success('Link copied')
                                                    }}
                                                    title="Copy link"
                                                >
                                                    <Share2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    asChild
                                                >
                                                    <Link to={`/leads/${lead.id}`} className="flex items-center gap-2">
                                                        <Eye className="h-4 w-4" />
                                                        <span>View</span>
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link to={`/leads/${lead.id}/email`} className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        <span>Email</span>
                                                    </Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-36 text-center">
                                        <div className="mx-auto max-w-sm">
                                            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                                            <p className="mt-3 font-semibold">No leads yet</p>
                                            <p className="mt-1 text-sm text-muted-foreground">Promote promising audit results from the Dashboard to build this list.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
