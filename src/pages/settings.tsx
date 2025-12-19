import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/auth-context'
import { User, Bell, Shield, Key } from 'lucide-react'

export function SettingsPage() {
    const { user } = useAuth()

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
                                <Input id="name" placeholder="Your name" defaultValue={user?.user_metadata?.full_name || ''} />
                            </div>
                            <div className="flex justify-end">
                                <Button>Save Changes</Button>
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
                </div>
            </div>
        </div>
    )
}
