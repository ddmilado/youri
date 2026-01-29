import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Plus, History, Settings, LogOut, Moon, Sun, Menu, Search, BookOpen, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: Plus, label: 'New Audit', path: '/new' },
  { icon: History, label: 'Audit Results', path: '/jobs' },
  { icon: Search, label: 'Find People', path: '/find-people' },
  { icon: BookOpen, label: 'Documentation', path: '/docs' },
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

  // Mobile Bottom Nav Items
  const mobileNavItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: Plus, label: 'New', path: '/new', isAction: true },
    { icon: History, label: 'Results', path: '/jobs' },
    { icon: Menu, label: 'Menu', action: () => setSidebarOpen(true) },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Top Header - Clean & Minimal */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md border-b border-border z-50 flex items-center px-4 justify-between transition-all duration-200">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-lg">
            <img src="/logo.svg" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <span className="font-bold text-lg tracking-tight">YourIntAI</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-full">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none",
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-slate-100 dark:to-slate-300">
              YourIntAI
            </span>
          </Link>
          {/* Close button for mobile drawer mode */}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <Plus className="h-5 w-5 rotate-45" />
          </Button>
        </div>

        <nav className="px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start relative overflow-hidden',
                    isActive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium'
                  )}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />}
                  <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
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
          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={cn(
        'flex-1 transition-all duration-200 min-h-screen',
        'lg:ml-64',
        'pt-14 pb-20 lg:pt-0 lg:pb-0' // Mobile: pad top for header, bottom for nav
      )}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe">
        <div className="flex items-center justify-between px-2 h-[3.5rem] pb-1">
          {mobileNavItems.map((item, index) => {
            const isActive = item.path && location.pathname.startsWith(item.path)

            if (item.isAction) {
              return (
                <div key={index} className="relative -top-5">
                  <Link to={item.path}>
                    <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-600/20 flex items-center justify-center text-white hover:scale-105 transition-transform">
                      <Plus className="h-7 w-7" />
                    </div>
                  </Link>
                </div>
              )
            }

            return (
              <div key={index} className="flex-1 flex justify-center">
                <button
                  onClick={() => item.action ? item.action() : navigate(item.path || '#')}
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-0.5",
                    isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 transition-all", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Mobile Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
