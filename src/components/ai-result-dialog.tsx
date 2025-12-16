import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Database } from '@/lib/supabase'
import { Building2, Globe, Users, Linkedin, Twitter, Mail, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

type LeadResult = Database['public']['Tables']['ai_lead_results']['Row']

interface AIResultDialogProps {
    lead: LeadResult | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AIResultDialog({ lead, open, onOpenChange }: AIResultDialogProps) {
    if (!lead) return null

    const getQualityColor = (label: string | null) => {
        if (!label) return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
        if (label.includes('High')) return 'bg-green-500/10 text-green-500 border-green-500/20'
        if (label.includes('Medium')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                {lead.company}
                                <Badge variant="outline" className={getQualityColor(lead.lead_quality_label)}>
                                    {lead.lead_quality_label || 'Unscored'}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-2">
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                    {lead.website} <ExternalLink className="h-3 w-3" />
                                </a>
                                {lead.industry && (
                                    <>
                                        <span>•</span>
                                        <span>{lead.industry}</span>
                                    </>
                                )}
                            </DialogDescription>
                        </div>
                        {lead.lead_quality_score !== null && (
                            <div className="flex flex-col items-end">
                                <span className="text-3xl font-bold text-primary">{lead.lead_quality_score}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Quality Score</span>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="localization">Localization</TabsTrigger>
                                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                            </TabsList>

                            {/* OVERVIEW TAB */}
                            <TabsContent value="overview" className="space-y-6">
                                {/* Company Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-primary" /> Company Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                                            <div className="text-muted-foreground">Founded</div>
                                            <div>{lead.founded || 'N/A'}</div>
                                            <div className="text-muted-foreground">Headquarters</div>
                                            <div>{lead.hq_location || 'N/A'}</div>
                                            <div className="text-muted-foreground">Employees</div>
                                            <div>{lead.employees || 'N/A'}</div>
                                            <div className="text-muted-foreground">Revenue (Est.)</div>
                                            <div>{lead.revenue_2023_eur || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-primary" /> Market Presence
                                        </h3>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground block mb-1">Target Markets</span>
                                                <div className="font-medium">{lead.markets || 'Global'}</div>
                                            </div>
                                            <div className="pt-2 flex gap-2">
                                                {lead.linkedin && (
                                                    <a href={lead.linkedin} target="_blank" rel="noreferrer">
                                                        <Button size="sm" variant="outline" className="h-8 gap-2">
                                                            <Linkedin className="h-3 w-3" /> LinkedIn
                                                        </Button>
                                                    </a>
                                                )}
                                                {lead.twitter && (
                                                    <a href={lead.twitter} target="_blank" rel="noreferrer">
                                                        <Button size="sm" variant="outline" className="h-8 gap-2">
                                                            <Twitter className="h-3 w-3" /> Twitter
                                                        </Button>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* AI Notes */}
                                {lead.notes && (
                                    <div className="rounded-lg border p-4 bg-card">
                                        <h3 className="font-semibold mb-2">AI Analysis Notes</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                            {lead.notes}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>


                            {/* LOCALIZATION TAB */}
                            <TabsContent value="localization" className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg border bg-card">
                                            <span className="text-sm font-medium text-muted-foreground">German Content Check</span>
                                            <div className="flex items-center gap-2 mt-2">
                                                {lead.localization_evidence?.german_content_on_main_domain ? (
                                                    <>
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                        <span className="font-semibold">Confirmed Available</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="h-5 w-5 text-red-500" />
                                                        <span className="font-semibold">Not Detected</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-lg border bg-card">
                                            <span className="text-sm font-medium text-muted-foreground">TLD (Top Level Domain)</span>
                                            <div className="text-lg font-mono mt-1">{lead.localization_evidence?.tld || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-lg border bg-card h-full">
                                        <h3 className="font-semibold mb-3">Localization Quality Evidence</h3>
                                        <p className="text-sm text-muted-foreground italic mb-4">
                                            "{lead.localization_evidence?.localization_quality_on_english_page || 'No specific evidence recorded'}"
                                        </p>
                                        <div className="text-sm">
                                            <span className="text-muted-foreground">Language Options: </span>
                                            <span className="font-medium">{lead.localization_evidence?.language_options || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>


                            {/* CONTACTS TAB */}
                            <TabsContent value="contacts" className="space-y-4">
                                {lead.contacts && lead.contacts.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {lead.contacts.map((contact: any, i: number) => (
                                            <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {contact.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold truncate">{contact.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate mb-2">{contact.title}</div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {contact.email && (
                                                            <a href={`mailto:${contact.email}`} className="text-xs flex items-center gap-1 text-blue-500 hover:underline">
                                                                <Mail className="h-3 w-3" /> Email
                                                            </a>
                                                        )}
                                                        {contact.linkedin && (
                                                            <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-blue-500 hover:underline">
                                                                <Linkedin className="h-3 w-3" /> LinkedIn
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No specific contacts identified.</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
