import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { Loader2, Search, Sparkles } from 'lucide-react'

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
    <div className="app-shell min-h-screen p-4 md:grid md:place-items-center">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm md:grid-cols-[1fr_28rem]">
        <section className="hidden bg-primary p-10 text-primary-foreground md:flex md:flex-col md:justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-white">
              <img src="/logo.svg" alt="YourIntAI Logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-lg font-bold">YourIntAI</p>
              <p className="text-xs text-primary-foreground/70">Lead intelligence workspace</p>
            </div>
          </Link>
          <div>
            <p className="eyebrow text-secondary">Get started</p>
            <h1 className="mt-3 max-w-md text-4xl font-bold tracking-tight text-balance">Build a prospecting workflow around smarter audits.</h1>
            <div className="mt-8 grid gap-3 text-sm text-primary-foreground/80">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-secondary" /> Analyze sites and extract sales context</div>
              <div className="flex items-center gap-2"><Search className="h-4 w-4 text-secondary" /> Discover companies by region and market</div>
            </div>
          </div>
        </section>

        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="space-y-1 pt-8">
            <Link to="/dashboard" className="flex justify-center mb-4 hover:opacity-80 transition-opacity md:hidden">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-border bg-white">
                <img src="/logo.svg" alt="YourIntAI Logo" className="h-10 w-10 object-contain" />
              </div>
            </Link>
            <CardTitle className="text-center text-3xl font-bold">Create account</CardTitle>
            <CardDescription className="text-center">Join YourIntAI to run premium site inspections</CardDescription>
          </CardHeader>
          <CardContent>
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
