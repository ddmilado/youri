import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Lead, updateLead, updateJob, CompanyInfo, getJobById, Contact } from "@/lib/supabase"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

interface EnrichLeadDialogProps {
    lead: Lead
    jobCompanyInfo?: CompanyInfo
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function EnrichLeadDialog({ lead, jobCompanyInfo, open, onOpenChange, onSuccess }: EnrichLeadDialogProps) {
    const [loading, setLoading] = useState(false)
    const [syncToReport, setSyncToReport] = useState(false)
    const [formData, setFormData] = useState<CompanyInfo>({
        name: lead.company_name || lead.title,
        industry: '',
        hq_location: '',
        employees: '',
        revenue: '',
        email: '',
        phone: '',
        contacts: []
    })

    // Load initial data when dialog opens
    useEffect(() => {
        if (open) {
            setSyncToReport(false)
            if (lead.company_data) {
                // Use existing enriched data
                setFormData(lead.company_data as CompanyInfo)
            } else if (jobCompanyInfo) {
                // Fallback to audit report data
                setFormData({
                    ...jobCompanyInfo,
                    name: lead.company_name || jobCompanyInfo.name || lead.title
                })
            } else {
                // Basic fallback
                setFormData(prev => ({ ...prev, name: lead.company_name || lead.title }))
            }
        }
    }, [open, lead, jobCompanyInfo])

    const handleChange = (field: keyof CompanyInfo, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const addContact = () => {
        const newContact: Contact = { name: '', title: '', email: '', linkedin: '' }
        handleChange('contacts', [...(formData.contacts || []), newContact])
    }

    const removeContact = (index: number) => {
        const newContacts = [...(formData.contacts || [])]
        newContacts.splice(index, 1)
        handleChange('contacts', newContacts)
    }

    const updateContact = (index: number, field: keyof Contact, value: string) => {
        const newContacts = [...(formData.contacts || [])]
        newContacts[index] = { ...newContacts[index], [field]: value }
        handleChange('contacts', newContacts)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 1. Update Lead (Enrichment)
            await updateLead(lead.id, {
                company_data: formData,
                company_name: formData.name // Also update top-level name if changed
            })

            // 2. Sync to Audit Report if requested
            if (syncToReport && lead.job_id) {
                // Fetch current job first to preserve other report data
                const job = await getJobById(lead.job_id)
                if (job && job.report) {
                    const updatedReport = {
                        ...job.report,
                        companyInfo: formData
                    }
                    await updateJob(lead.job_id, {
                        report: updatedReport
                    })
                    toast.info("Original Audit Report updated")
                }
            }

            toast.success("Lead enriched successfully")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("Failed to update lead")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Enrich Lead Information</DialogTitle>
                    <DialogDescription>
                        Add or edit company details and multiple contacts manually.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold border-b pb-2">Company Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industry</Label>
                                    <Input
                                        id="industry"
                                        value={formData.industry || ''}
                                        onChange={e => handleChange('industry', e.target.value)}
                                        placeholder="e.g. SaaS, Healthcare"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="location">HQ Location</Label>
                                    <Input
                                        id="location"
                                        value={formData.hq_location || ''}
                                        onChange={e => handleChange('hq_location', e.target.value)}
                                        placeholder="e.g. San Francisco, CA"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="employees">Employees</Label>
                                    <Input
                                        id="employees"
                                        value={formData.employees || ''}
                                        onChange={e => handleChange('employees', e.target.value)}
                                        placeholder="e.g. 50-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="revenue">Revenue</Label>
                                    <Input
                                        id="revenue"
                                        value={formData.revenue || ''}
                                        onChange={e => handleChange('revenue', e.target.value)}
                                        placeholder="e.g. $5M - $10M"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>General Contact Info</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        placeholder="Company Email"
                                        value={formData.email || ''}
                                        onChange={e => handleChange('email', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Company Phone"
                                        value={formData.phone || ''}
                                        onChange={e => handleChange('phone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="text-sm font-semibold">Key Contacts / People</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addContact} className="h-8">
                                    <Plus className="h-4 w-4 mr-1" /> Add Person
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {formData.contacts && formData.contacts.length > 0 ? (
                                    formData.contacts.map((contact, index) => (
                                        <div key={index} className="p-4 border rounded-lg bg-slate-50/50 relative space-y-3">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeContact(index)}
                                                className="absolute top-2 right-2 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Full Name</Label>
                                                    <Input
                                                        value={contact.name}
                                                        onChange={e => updateContact(index, 'name', e.target.value)}
                                                        placeholder="e.g. John Doe"
                                                        className="h-9"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Title / Role</Label>
                                                    <Input
                                                        value={contact.title}
                                                        onChange={e => updateContact(index, 'title', e.target.value)}
                                                        placeholder="e.g. Marketing Director"
                                                        className="h-9"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Contact Email</Label>
                                                    <Input
                                                        value={contact.email || ''}
                                                        onChange={e => updateContact(index, 'email', e.target.value)}
                                                        placeholder="email@company.com"
                                                        className="h-9"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">LinkedIn URL</Label>
                                                    <Input
                                                        value={contact.linkedin || ''}
                                                        onChange={e => updateContact(index, 'linkedin', e.target.value)}
                                                        placeholder="linkedin.com/in/..."
                                                        className="h-9"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                        No specific contacts added yet. Click "Add Person" above.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sync Checkbox */}
                        {lead.job_id && (
                            <div className="flex items-center space-x-2 pt-4 border-t">
                                <Checkbox
                                    id="syncReport"
                                    checked={syncToReport}
                                    onCheckedChange={(checked) => setSyncToReport(checked as boolean)}
                                />
                                <Label
                                    htmlFor="syncReport"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Update original Audit Report too
                                </Label>
                            </div>
                        )}
                        {lead.job_id && syncToReport && (
                            <p className="text-[10px] text-muted-foreground ml-6">
                                This will overwrite the Company Info and Contacts in the source audit report.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
