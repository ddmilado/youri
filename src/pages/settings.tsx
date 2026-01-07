import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/auth-context'
import { User, Bell, Shield, Key, Users, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export function SettingsPage() {
    const { user } = useAuth()
    const [teamMembers, setTeamMembers] = useState<any[]>([])
    const [newMemberEmail, setNewMemberEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || '')
    const [updatingProfile, setUpdatingProfile] = useState(false)

    useEffect(() => {
        if (user) {
            fetchTeamMembers()
            setDisplayName(user.user_metadata?.full_name || '')
        }
    }, [user])

    const handleSaveProfile = async () => {
        setUpdatingProfile(true)
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: displayName }
            })
            if (error) throw error
            toast.success('Profile updated')
        } catch (error: any) {
            toast.error('Failed to update profile: ' + error.message)
        } finally {
            setUpdatingProfile(false)
        }
    }

    const fetchTeamMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('*')
                .eq('inviter_id', user?.id)

            if (error) {
                // Ignore 404/PGRST/undefined table error silently initially as user needs to run migration
                console.log('Error fetching team:', error)
            } else {
                setTeamMembers(data || [])
            }
        } catch (e) {
            console.log('Team table likely missing', e)
        }
    }

    const inviteMember = async () => {
        if (!newMemberEmail) return
        setLoading(true)
        try {
            const { error } = await supabase
                .from('team_members')
                .insert({
                    inviter_id: user?.id,
                    member_email: newMemberEmail,
                    status: 'active' // Auto-active for simplicity relative to auth linking
                })

            if (error) throw error
            toast.success('Team member added')
            setNewMemberEmail('')
            fetchTeamMembers()
        } catch (error: any) {
            toast.error('Failed to add member: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const removeMember = async (id: string) => {
        try {
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Member removed')
            fetchTeamMembers()
        } catch (error: any) {
            toast.error('Failed to remove member')
        }
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <div className="flex h-16 items-center border-b border-border px-6 bg-background flex-shrink-0 shadow-sm">
                <h1 className="text-lg font-semibold md:text-xl">Settings</h1>
            </div>

            <div className="flex-1 overflow-auto p-6 max-w-4xl">
                <div className="grid gap-6">
                    {/* Profile Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <CardTitle>Profile</CardTitle>
                            </div>
                            <CardDescription>Manage your public profile and account details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={user?.email || ''} disabled />
                            </div>
                            <div className="grid gap-2">

                                <Label htmlFor="name">Display Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Your name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleSaveProfile} disabled={updatingProfile || !displayName}>
                                    {updatingProfile ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-muted-foreground" />
                                <CardTitle>Notifications</CardTitle>
                            </div>
                            <CardDescription>Configure how you receive alerts</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium">Email Notifications</div>
                                    <div className="text-sm text-muted-foreground">Receive daily summaries of your audits</div>
                                </div>
                                {/* Placeholder for switch, using button for now if switch missing */}
                                <Button variant="outline" size="sm">Enabled</Button>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium">marketing emails</div>
                                    <div className="text-sm text-muted-foreground">Receive updates about new features</div>
                                </div>
                                <Button variant="outline" size="sm">Disabled</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-muted-foreground" />
                                <CardTitle>Security</CardTitle>
                            </div>
                            <CardDescription>Manage your password and API keys</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium">Password</div>
                                    <div className="text-sm text-muted-foreground">Last changed 3 months ago</div>
                                </div>
                                <Button variant="outline">Change Password</Button>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="font-medium">API Keys</div>
                                    <div className="text-sm text-muted-foreground">Manage your Firecrawl and OpenAI keys</div>
                                </div>
                                <Button variant="outline">
                                    <Key className="mr-2 h-4 w-4" />
                                    Manage Keys
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team Members Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-muted-foreground" />
                                <CardTitle>Team Members</CardTitle>
                            </div>
                            <CardDescription>Invite colleagues to collaborate on audits</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-end gap-3">
                                <div className="grid gap-2 flex-1">
                                    <Label htmlFor="new-member">Add Team Member</Label>
                                    <Input
                                        id="new-member"
                                        placeholder="colleague@company.com"
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                                    />
                                </div>
                                <Button onClick={inviteMember} disabled={loading}>
                                    {loading ? 'Adding...' : 'Add Member'}
                                </Button>
                            </div>

                            {teamMembers.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">Active Members</h3>
                                        <div className="grid gap-3">
                                            {teamMembers.map((member) => (
                                                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-medium text-xs">
                                                            {member.member_email.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="grid gap-0.5">
                                                            <div className="text-sm font-medium">{member.member_email}</div>
                                                            <div className="text-xs text-muted-foreground capitalize">{member.status}</div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={() => removeMember(member.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
