import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { BackgroundTasksProvider } from '@/contexts/background-tasks-context'
import { ThemeProvider } from '@/components/theme-provider'
import { ProtectedRoute } from '@/components/protected-route'
import { Layout } from '@/components/layout'
import { FloatingTaskIndicator } from '@/components/floating-task-indicator'
import { LoginPage } from '@/pages/login'
import { SignupPage } from '@/pages/signup'
import { Toaster } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Analytics } from "@vercel/analytics/react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

// Lazy load pages to reduce initial bundle

const Dashboard = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const Leads = lazy(() => import('@/pages/leads').then(m => ({ default: m.LeadsPage })))
const LeadDetails = lazy(() => import('@/pages/lead-details').then(m => ({ default: m.LeadDetailsPage })))
const NewAudit = lazy(() => import('@/pages/new-audit').then(m => ({ default: m.NewAuditPage })))
const Report = lazy(() => import('@/pages/report').then(m => ({ default: m.ReportPage })))
const Jobs = lazy(() => import('@/pages/jobs').then(m => ({ default: m.JobsPage })))
const Settings = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const Debug = lazy(() => import('@/pages/debug').then(m => ({ default: m.DebugPage })))
const FindPeople = lazy(() => import('@/pages/find-people').then(m => ({ default: m.FindPeoplePage })))
const Docs = lazy(() => import('@/pages/docs').then(m => ({ default: m.DocsPage })))

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
)

const ReportPageWrapper = () => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingFallback />

  if (user) {
    return (
      <Layout>
        <Report />
      </Layout>
    )
  }

  return <Report />
}

function App() {
  // Show configuration error page if Supabase is not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Configuration Required</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            Supabase environment variables are missing. Please configure them to use this application.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4 mb-4">
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-2">Required variables:</p>
            <ul className="text-sm font-mono text-gray-600 dark:text-gray-400 space-y-1">
              <li>• VITE_SUPABASE_URL</li>
              <li>• VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500 space-y-2">
            <p>📖 See <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">SETUP.md</code> for instructions</p>
            <p>💡 Copy <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env.example</code> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env</code></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <AuthProvider>
          <BackgroundTasksProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/debug" element={<Suspense fallback={<LoadingFallback />}><Debug /></Suspense>} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <Dashboard />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <Leads />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <LeadDetails />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/new"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <NewAudit />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report/:id"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ReportPageWrapper />
                    </Suspense>
                  }
                />
                <Route
                  path="/jobs"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <Jobs />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/find-people"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <FindPeople />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <Settings />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/docs"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<LoadingFallback />}>
                          <Docs />
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              <FloatingTaskIndicator />
              <Analytics />
            </BrowserRouter>
            <Toaster position="top-right" richColors />
          </BackgroundTasksProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
