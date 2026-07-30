import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { BarChart3, Loader2, Search, ShieldCheck } from 'lucide-react'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password)
      toast.success('Account created! Please verify your email')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:grid md:place-items-center">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-lg border border-border/70 bg-card shadow-lg shadow-slate-950/5 md:grid-cols-[1fr_28rem]">
        <section className="hidden bg-slate-950 p-10 text-white md:flex md:flex-col md:justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-white">
              <img src="/logo.svg" alt="YourIntAI Logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-lg font-bold">YourInt</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Research OS</p>
            </div>
          </Link>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">Create your research workspace</p>
            <h1 className="mt-3 max-w-md text-4xl font-bold tracking-[-0.04em] text-balance">Turn live web evidence into better decisions.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
              Browse company websites, evaluate their market presence, and keep every useful finding connected to its source.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-white/75">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-secondary" /> Analyze sites and extract sales context</div>
              <div className="flex items-center gap-2"><Search className="h-4 w-4 text-secondary" /> Discover companies by region and market</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-xs text-white/60">
            <div><p className="text-lg font-bold text-white">Audit</p><p>evidence</p></div>
            <div><p className="text-lg font-bold text-white">Lead</p><p>pipeline</p></div>
            <div><p className="text-lg font-bold text-white">Email</p><p>drafts</p></div>
          </div>
        </section>

        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="space-y-1 px-6 pt-8 md:px-8">
            <Link to="/dashboard" className="flex justify-center mb-4 hover:opacity-80 transition-opacity md:hidden">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-border bg-white">
                <img src="/logo.svg" alt="YourIntAI Logo" className="h-10 w-10 object-contain" />
              </div>
            </Link>
            <CardTitle className="text-center text-2xl font-bold">Create workspace account</CardTitle>
            <CardDescription className="text-center">Start running audit-led lead workflows.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 md:px-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-secondary" />
              Your reports and leads are protected by workspace access controls.
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-secondary hover:underline font-semibold">Sign in</Link>
            </p>
          </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
