import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getLeadById, getJobById, deleteProjectLeads } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, FileText, ArrowLeft, Users, Building2, Globe, Calendar, Mail, Phone, Trash2, Wand2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useState } from 'react'
import { EnrichLeadDialog } from '@/components/enrich-lead-dialog'

export function LeadDetailsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [enrichOpen, setEnrichOpen] = useState(false)

    const { data: lead, isLoading: isLoadingLead, refetch: refetchLead } = useQuery({
        queryKey: ['lead', id],
        queryFn: () => id ? getLeadById(id) : Promise.resolve(null),
        enabled: !!id,
    })

    const { data: job, isLoading: isLoadingJob } = useQuery({
        queryKey: ['job', lead?.job_id],
        queryFn: () => (lead?.job_id ? getJobById(lead.job_id) : Promise.resolve(null)),
        enabled: !!lead?.job_id,
    })

    const handleDelete = async () => {
        if (!lead || !confirm('Are you sure you want to delete this lead?')) return
        try {
            await deleteProjectLeads([lead.id])
            toast.success('Lead deleted')
            navigate('/leads')
        } catch (error) {
            toast.error('Failed to delete lead')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'won': return 'bg-green-100 text-green-700 border-green-200'
            case 'new': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'qualified': return 'bg-purple-100 text-purple-700 border-purple-200'
            case 'contacted': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'lost': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    if (isLoadingLead) {
        return <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-64 w-full" />
        </div>
    }

    if (!lead) {
        return <div className="p-8 text-center">Lead not found</div>
    }

    // Prepare display data with fallback logic
    const companyInfo = lead.company_data || job?.report?.companyInfo || {}
    const companyName = lead.company_name || lead.title

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Link to="/leads" className="hover:text-foreground flex items-center gap-1 transition-colors">
                            <ArrowLeft className="h-3 w-3" /> Back to Leads
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
                        <Badge variant="outline" className={`${getStatusColor(lead.status)} text-sm px-2.5 py-0.5`}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                        </Badge>
                    </div>
                    <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-blue-600 flex items-center gap-1.5 transition-colors w-fit"
                    >
                        <Globe className="h-4 w-4" />
                        {lead.url}
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setEnrichOpen(true)} className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4" /> Enrich
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Delete Lead
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Company & Audit Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Access to Report */}
                    {job?.status === 'completed' && (
                        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg text-emerald-900">Full Audit Report Available</h3>
                                    <p className="text-emerald-700/80 text-sm mt-1">
                                        View the complete technical analysis and recommendations for this lead.
                                    </p>
                                </div>
                                <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-sm" asChild>
                                    <Link to={`/report/${job.id}`} className="flex items-center gap-2">
                                        <span>View Full Report</span>
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Company Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                Company Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingJob ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-8 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            ) : (companyInfo.industry || companyInfo.revenue || companyInfo.email) ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-muted/20 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Industry</div>
                                            <div className="font-medium">{companyInfo.industry || 'N/A'}</div>
                                        </div>
                                        <div className="p-4 bg-muted/20 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Location</div>
                                            <div className="font-medium">{companyInfo.hq_location || 'N/A'}</div>
                                        </div>
                                        <div className="p-4 bg-muted/20 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Employees</div>
                                            <div className="font-medium">{companyInfo.employees || 'N/A'}</div>
                                        </div>
                                        <div className="p-4 bg-muted/20 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue</div>
                                            <div className="font-medium">{companyInfo.revenue || 'N/A'}</div>
                                        </div>
                                    </div>

                                    {(companyInfo.email || companyInfo.phone) && (
                                        <div className="p-4 border rounded-lg">
                                            <h4 className="text-sm font-medium mb-3">Contact Details</h4>
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                {companyInfo.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                                        <a href={`mailto:${companyInfo.email}`} className="text-sm text-blue-600 hover:underline">
                                                            {companyInfo.email}
                                                        </a>
                                                    </div>
                                                )}
                                                {companyInfo.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{companyInfo.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Key Contacts List */}
                                    {companyInfo.contacts && companyInfo.contacts.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Users className="h-4 w-4" /> Key People
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {companyInfo.contacts.map((contact: any, idx: number) => (
                                                    <div key={idx} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                                        <div className="font-medium text-sm">{contact.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{contact.title}</div>
                                                        {contact.email && <div className="text-xs text-blue-600 mt-1 truncate">{contact.email}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    No detailed company information available.
                                    <Button variant="link" onClick={() => setEnrichOpen(true)} className="mt-2 text-primary">
                                        Enrich now
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Sidebar */}
                <div className="space-y-6">
                    {/* Audit Summary Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-4 w-4 text-primary" />
                                Audit Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoadingJob ? (
                                <Skeleton className="h-20 w-full" />
                            ) : job ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                                            <div className="text-2xl font-bold text-foreground">
                                                {job.score ? job.score : '-'}
                                            </div>
                                            <div className="text-xs text-muted-foreground uppercase mt-1">Score</div>
                                        </div>
                                        <div className="text-center p-3 bg-muted/30 rounded-lg">
                                            <div className="text-2xl font-bold text-amber-600">
                                                {job.report?.issuesCount || 0}
                                            </div>
                                            <div className="text-xs text-muted-foreground uppercase mt-1">Issues</div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground">
                                        Audit Status: <span className="font-medium text-foreground capitalize">{job.status}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">No audit data linked.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Lead Metadata */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                                    <Users className="h-4 w-4" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-xs text-muted-foreground">Created By</p>
                                    <p className="text-sm font-medium truncate" title={lead.creator_name || 'Team Member'}>
                                        {lead.creator_name || 'Team Member'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Date Added</p>
                                    <p className="text-sm font-medium">
                                        {new Date(lead.created_at).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {lead && (
                <EnrichLeadDialog
                    lead={lead}
                    jobCompanyInfo={job?.report?.companyInfo}
                    open={enrichOpen}
                    onOpenChange={setEnrichOpen}
                    onSuccess={() => {
                        refetchLead()
                    }}
                />
            )}
        </div>
    )
}
