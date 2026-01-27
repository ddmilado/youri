import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Lead, getJobById } from "@/lib/supabase"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, FileText, AlertTriangle, CheckCircle2, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"

interface LeadDetailsDialogProps {
    lead: Lead | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
    const { data: job, isLoading } = useQuery({
        queryKey: ['job', lead?.job_id],
        queryFn: () => (lead?.job_id ? getJobById(lead.job_id) : Promise.resolve(null)),
        enabled: !!lead?.job_id && open,
    })

    if (!lead) return null

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-xl">{lead.company_name || lead.title}</DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-2">
                                <a
                                    href={lead.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:underline text-blue-600"
                                >
                                    {lead.url}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </DialogDescription>
                        </div>
                        <Badge variant="outline" className={getStatusColor(lead.status)}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Creator Info */}
                    {/* Creator Info */}
                    <div className="flex flex-col sm:flex-row gap-6 p-4 bg-slate-50/50 rounded-xl border">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Created By</p>
                                <p className="font-semibold text-base text-foreground">
                                    {lead.creator_name || 'Team Member'}
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-10 bg-border hidden sm:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Date Added</p>
                                <p className="font-semibold text-base text-foreground">
                                    {new Date(lead.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                    <span className="text-xs font-normal text-muted-foreground ml-2">
                                        ({formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })})
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>


                    {isLoading ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : job && job.report?.companyInfo ? (
                        <div className="space-y-6">
                            {/* Company Information Grid */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Company Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Industry</div>
                                        <div className="font-medium">{job.report.companyInfo.industry || 'N/A'}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Location</div>
                                        <div className="font-medium">{job.report.companyInfo.hq_location || 'N/A'}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Employees</div>
                                        <div className="font-medium">{job.report.companyInfo.employees || 'N/A'}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Revenue</div>
                                        <div className="font-medium">{job.report.companyInfo.revenue || 'N/A'}</div>
                                    </div>
                                    {(job.report.companyInfo.email || job.report.companyInfo.phone) && (
                                        <div className="col-span-1 sm:col-span-2 p-3 border rounded-lg bg-card text-card-foreground shadow-sm">
                                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Contact Details</div>
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                {job.report.companyInfo.email && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground">Email: </span>
                                                        <a href={`mailto:${job.report.companyInfo.email}`} className="text-sm text-blue-600 hover:underline">{job.report.companyInfo.email}</a>
                                                    </div>
                                                )}
                                                {job.report.companyInfo.phone && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground">Phone: </span>
                                                        <span className="text-sm">{job.report.companyInfo.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Key Contacts */}
                            {job.report.companyInfo.contacts && job.report.companyInfo.contacts.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        Key Contacts
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {job.report.companyInfo.contacts.map((contact, idx) => (
                                            <div key={idx} className="p-3 border rounded-lg bg-muted/20">
                                                <div className="font-medium text-sm">{contact.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{contact.title}</div>
                                                {contact.email && <div className="text-xs text-blue-600 mt-1 truncate">{contact.email}</div>}
                                                {contact.linkedin && <div className="text-xs text-blue-600 mt-1 truncate hover:underline"><a href={contact.linkedin} target="_blank" rel="noreferrer">LinkedIn Profile</a></div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Audit Highlights */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    Audit Highlights
                                </h3>
                                <div className="grid gap-4 border rounded-lg p-4 bg-muted/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium">Audit Score</div>
                                            <div className={`text-2xl font-bold mt-1 ${(job.score || 0) >= 80 ? 'text-green-600' :
                                                    (job.score || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {job.score ? `${job.score}/100` : 'N/A'}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-sm font-medium">Issues Found</div>
                                            <div className="flex items-center gap-1 justify-end mt-1 text-amber-600 font-bold">
                                                <AlertTriangle className="h-4 w-4" />
                                                {job.report?.issuesCount || 0}
                                            </div>
                                        </div>
                                    </div>

                                    {job.status === 'completed' ? (
                                        <Button size="sm" variant="outline" className="w-full mt-2" asChild>
                                            <Link to={`/report/${job.id}`}>
                                                View Full Technical Report
                                            </Link>
                                        </Button>
                                    ) : (
                                        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            Audit is currently {job.status}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                            <p>No company information available from the audit.</p>
                            {job?.status && job.status !== 'completed' && <p className="text-sm mt-1 text-yellow-600">Audit is still {job.status}</p>}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
