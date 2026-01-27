import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Trash2, ExternalLink, Eye } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getLeads, deleteProjectLeads, type Lead } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useState } from 'react'
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
    let colorClass = "text-gray-600 bg-gray-100 border-gray-200"
    if (status === 'won') colorClass = "text-green-700 bg-green-50 border-green-200"
    else if (status === 'new') colorClass = "text-blue-700 bg-blue-50 border-blue-200"
    else if (status === 'qualified') colorClass = "text-purple-700 bg-purple-50 border-purple-200"
    else if (status === 'contacted') colorClass = "text-yellow-700 bg-yellow-50 border-yellow-200"
    else if (status === 'lost') colorClass = "text-red-700 bg-red-50 border-red-200"

    const label = status.charAt(0).toUpperCase() + status.slice(1)

    return (
        <div className={`flex items-center gap-2 px-2.5 py-0.5 rounded-full border w-fit ${colorClass}`}>
            <span className="font-semibold text-xs">{label}</span>
        </div>
    )
}

import { Link } from 'react-router-dom'

// ... (imports remain)

export function LeadsPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
    const [isDeleting, setIsDeleting] = useState(false)

    // Dialog State removed

    const { data: leads, isLoading } = useQuery({
        queryKey: ['leads'],
        queryFn: getLeads,
        enabled: !!user,
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
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your potential opportunities and track progress.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
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
                                        <TableCell className="font-medium">
                                            {lead.company_name || lead.title}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                            <a href={lead.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                                {lead.url}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={lead.status} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {lead.created_by === user?.id ? (
                                                    <Badge variant="outline" className="text-[10px] h-5 font-normal bg-slate-50 text-slate-500 border-slate-200">You</Badge>
                                                ) : (
                                                    <span className="text-sm">{lead.creator_name || 'Team Member'}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                asChild
                                                className="hover:bg-slate-200"
                                            >
                                                <Link to={`/leads/${lead.id}`} className="flex items-center gap-2">
                                                    <Eye className="h-4 w-4" />
                                                    <span>View</span>
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No leads found. Push leads from your audits in the Dashboard.
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
