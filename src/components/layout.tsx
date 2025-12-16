import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Plus, History, Settings, LogOut, Moon, Sun, Menu } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Plus, label: 'New Audit', path: '/new' },
  { icon: History, label: 'Audit Results', path: '/jobs' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign out')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-3 font-bold text-xl">SiteAudit</span>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card border-r z-40 transition-transform duration-200",
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold">SiteAudit</h1>
        </div>
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start', isActive && 'bg-primary/10 text-primary')}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-6 left-3 right-3 space-y-2">
          <Button variant="ghost" className="w-full justify-start hidden lg:flex" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="mr-3 h-5 w-5" /> : <Moon className="mr-3 h-5 w-5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleSignOut}>
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className={cn('min-h-screen transition-all duration-200', 'lg:ml-64', 'pt-16 lg:pt-0')}>{children}</main>

      <Link to="/new" className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
