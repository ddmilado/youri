import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { FileSearch, Globe2, Loader2, Mail, ShieldCheck } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, signInWithMagicLink } = useAuth()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Logged in successfully!')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to login with Google')
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Please enter your email')
      return
    }
    setLoading(true)
    try {
      await signInWithMagicLink(email)
      setMagicLinkSent(true)
      toast.success('Magic link sent! Check your email')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:grid md:place-items-center">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-card shadow-overlay md:grid-cols-[1fr_28rem]">
        <section className="relative hidden overflow-hidden bg-[hsl(var(--ink-950))] p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border border-blue-400/15" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-blue-400/15" />
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
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">Evidence-led market research</p>
            <h1 className="mt-3 max-w-md text-4xl font-bold tracking-[-0.04em] text-balance">See the market through verified evidence.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
              Give Hermes a website or market question. Follow its browser activity, inspect the sources, and turn useful findings into action.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-white/75">
              <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-blue-300" /> Live website browsing on every audit</div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-300" /> Findings connected to their evidence</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-xs text-white/60">
            <div><FileSearch className="mb-2 h-4 w-4 text-blue-300" /><p>Website audits</p></div>
            <div><Globe2 className="mb-2 h-4 w-4 text-blue-300" /><p>Company discovery</p></div>
            <div><ShieldCheck className="mb-2 h-4 w-4 text-blue-300" /><p>Evidence trail</p></div>
          </div>
        </section>

        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="space-y-1 px-6 pt-8 md:px-8">
            <Link to="/dashboard" className="flex justify-center mb-4 hover:opacity-80 transition-opacity md:hidden">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-border bg-white">
                <img src="/logo.svg" alt="YourIntAI Logo" className="h-10 w-10 object-contain" />
              </div>
            </Link>
            <CardTitle className="text-center text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription className="text-center">Sign in to your research workspace.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 md:px-8">
            {magicLinkSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-6 w-6 text-secondary" />
                </div>
              <div>
                <h3 className="font-semibold text-lg">Check your email</h3>
                <p className="text-sm text-muted-foreground mt-1">We sent a magic link to {email}</p>
              </div>
              <Button variant="outline" onClick={() => setMagicLinkSent(false)} className="w-full">
                Back to login
              </Button>
            </div>
            ) : (
              <div className="space-y-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleGoogleLogin} disabled={loading}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                  Google
                </Button>
                <Button variant="outline" onClick={handleMagicLink} disabled={loading}>
                  <Mail className="mr-2 h-4 w-4" />
                  Magic Link
                </Button>
              </div>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
