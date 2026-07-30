import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  BookOpen,
  ChevronRight,
  FileSearch,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
      { icon: FileSearch, label: 'Research', path: '/new' },
      { icon: History, label: 'Results', path: '/jobs' },
      { icon: Users, label: 'Leads', path: '/leads' },
    ],
  },
  {
    label: 'Enrichment',
    items: [{ icon: Search, label: 'Find people', path: '/find-people' }],
  },
  {
    label: 'System',
    items: [
      { icon: BookOpen, label: 'Documentation', path: '/docs' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)

  useEffect(() => setSidebarOpen(false), [location.pathname])

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

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Workspace member'
  const initials = displayName
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === path
      : location.pathname.startsWith(path)

  const mobileNav = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: History, label: 'Results', path: '/jobs' },
    { icon: Plus, label: 'Research', path: '/new', action: true },
    { icon: Users, label: 'Leads', path: '/leads' },
  ]

  return (
    <div className="app-shell min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="YourInt overview">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white dark:bg-slate-950">
            <img src="/logo.svg" alt="" className="h-5 w-5 object-contain" />
          </div>
          <div className="leading-none">
            <span className="block text-sm font-bold tracking-tight">YourInt</span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research OS</span>
          </div>
        </Link>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle color theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-card transition-transform duration-200 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full'
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-[76px] items-center justify-between px-5">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="YourInt overview">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-white dark:bg-slate-950">
              <img src="/logo.svg" alt="" className="h-6 w-6 object-contain" />
            </div>
            <div className="min-w-0 leading-none">
              <span className="block text-base font-bold tracking-tight">YourInt</span>
              <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research OS</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3">
          <Button asChild className="w-full justify-between">
            <Link to="/new">
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Start research
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" />
            </Link>
          </Button>
        </div>

        <nav className="mt-5 flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'pressable relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active && 'bg-primary/[0.07] font-semibold text-foreground'
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                      <item.icon className={cn('h-[18px] w-[18px]', active && 'text-primary')} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-muted-foreground" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setSignOutDialogOpen(true)} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="min-h-screen pb-20 pt-14 outline-none lg:ml-[248px] lg:pb-0 lg:pt-0">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-safe backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="grid h-16 grid-cols-5 px-1">
          {mobileNav.slice(0, 2).map((item) => (
            <MobileNavItem key={item.path} {...item} active={isActive(item.path)} />
          ))}
          <Link to="/new" className="relative flex items-center justify-center" aria-label="Start research">
            <span className="absolute -top-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-overlay">
              <Plus className="h-6 w-6" />
            </span>
            <span className="mt-9 text-[10px] font-semibold text-primary">Research</span>
          </Link>
          {mobileNav.slice(3).map((item) => (
            <MobileNavItem key={item.path} {...item} active={isActive(item.path)} />
          ))}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="pressable flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
            aria-label="Open full menu"
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
        </div>
      </nav>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ConfirmDialog
        open={signOutDialogOpen}
        onOpenChange={setSignOutDialogOpen}
        title="Sign out?"
        description="You will need to sign in again before accessing your workspace."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        variant="warning"
        onConfirm={handleSignOut}
      />
    </div>
  )
}

function MobileNavItem({
  icon: Icon,
  label,
  path,
  active,
}: {
  icon: typeof LayoutDashboard
  label: string
  path: string
  active: boolean
}) {
  return (
    <Link
      to={path}
      className={cn(
        'pressable flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground',
        active && 'text-primary'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  )
}
