import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Database } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Check, CheckCircle2, Globe2, Loader2, Search, X, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBackgroundTasks } from '@/contexts/background-tasks-context'

type Job = Database['public']['Tables']['jobs']['Row']

interface ProcessingOverlayProps {
    jobId?: string
    onClose: () => void
    onMinimize?: () => void
    type?: 'audit' | 'search'
    manualSubtitle?: string
    isManualComplete?: boolean
    onManualComplete?: () => void
}

export function ProcessingOverlay({
    jobId,
    onClose,
    onMinimize,
    type = 'audit',
    manualSubtitle,
    isManualComplete,
    onManualComplete
}: ProcessingOverlayProps) {
    const navigate = useNavigate()
    const [job, setJob] = useState<Partial<Job> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [progressValue, setProgressValue] = useState(0)
    const [simulatedStep, setSimulatedStep] = useState(0)

    const auditSteps = [
        'Preparing the browser session',
        'Navigating the website',
        'Inspecting key journeys and claims',
        'Collecting evidence from live pages',
        'Structuring the audit report',
    ]

    const searchSteps = [
        'Interpreting the search brief',
        'Searching the live web',
        'Opening candidate websites',
        'Verifying companies against the brief',
        'Structuring the discovery results',
    ]

    const loadingSteps = type === 'audit' ? auditSteps : searchSteps

    // 1. Job Monitoring & Realtime Subscriptions
    useEffect(() => {
        if (!jobId) return

        console.log('ProcessingOverlay useEffect - type:', type, 'jobId:', jobId)

        if (type === 'audit') {
            console.log('Setting up audit monitoring for jobId:', jobId)
            const fetchJob = async (silent = false) => {
                console.log('Fetching job status for:', jobId)
                const { data, error: jobError } = await supabase.from('jobs').select('*').eq('id', jobId).single()
                if (jobError) {
                    if (!silent) {
                        console.error('Error fetching job:', jobError)
                        setError('Could not find this analysis job.')
                    }
                    return null
                }
                const updatedJob = data as Job
                console.log('Job status:', updatedJob.status, 'message:', updatedJob.status_message)
                setJob(updatedJob)

                if (updatedJob.status === 'completed') {
                    console.log('Job completed! Report available:', !!updatedJob.report)
                    setProgressValue(100)
                    toast.success('Analysis complete!')
                }
                if (updatedJob.status === 'failed') {
                    console.log('Job failed:', updatedJob.status_message)
                    setError(updatedJob.status_message || 'The analysis failed. Please try again or check the URL.')
                }
                return updatedJob
            }

            fetchJob()

            const channel = supabase
                .channel(`job-status-${jobId}`, {
                    config: { broadcast: { self: true } },
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (payload) => {
                    console.log('Postgres change received:', payload)
                    const updatedJob = payload.new as Job
                    setJob(prev => ({ ...prev, ...updatedJob }))
                    if (updatedJob.status === 'completed') {
                        console.log('Job completed via postgres_changes')
                        setProgressValue(100)
                        toast.success('Analysis complete!')
                    }
                    if (updatedJob.status === 'failed') {
                        console.log('Job failed via postgres_changes')
                        setError(updatedJob.status_message || 'Analysis failed')
                    }
                })
                .on('broadcast', { event: 'status_update' }, ({ payload }) => {
                    console.log('Broadcast received:', payload)
                    setJob(prev => prev ? { ...prev, status_message: payload.message, status: payload.status } : null)
                    if (payload.status === 'completed') {
                        console.log('Job completed via broadcast')
                        setProgressValue(100)
                        toast.success('Analysis complete!')
                    }
                    if (payload.status === 'failed') {
                        console.log('Job failed via broadcast')
                        setError(payload.message || 'Analysis failed')
                    }
                })
                .subscribe((status) => {
                    console.log('Channel subscription status:', status)
                })

            const pollInterval = setInterval(() => fetchJob(true), 2000) // Poll every 2 seconds

            // Timeout fallback - show error after 5 minutes if still processing
            const timeout = setTimeout(() => {
                console.log('Audit timeout - checking final status')
                fetchJob(false).then((latestJob) => {
                    // If still processing after 5 minutes, show a warning
                    if (latestJob?.status === 'processing' || latestJob?.status === 'pending') {
                        console.log('Audit still processing after timeout')
                        toast.warning('Audit is taking longer than expected. Check the Site Audits tab for status.')
                    }
                })
            }, 300000) // 5 minutes

            return () => {
                supabase.removeChannel(channel)
                clearInterval(pollInterval)
                clearTimeout(timeout)
            }
        }

        if (type === 'search') {
            console.log('Setting up search monitoring for jobId:', jobId)
            setJob({
                id: jobId,
                status: 'processing',
                status_message: 'Initializing search...',
                title: manualSubtitle || 'Keyword Search',
                url: manualSubtitle || 'Keyword Search'
            })

            let completionHandled = false
            const handleCompletedSearch = () => {
                if (completionHandled) return
                completionHandled = true
                setProgressValue(100)
                if (onManualComplete) setTimeout(onManualComplete, 1500)
            }

            const channel = supabase
                .channel(`search-status-${jobId}`)
                .on('broadcast', { event: 'status_update' }, ({ payload }) => {
                    console.log('Search broadcast received:', payload)
                    setJob(prev => ({
                        ...(prev || {}),
                        status_message: payload.message,
                        status: payload.status
                    }))

                    if (payload.status === 'completed') handleCompletedSearch()
                    if (payload.status === 'failed') setError(payload.message || 'Agent search failed')
                })
                .subscribe()

            const pollSearch = async () => {
                const { data } = await supabase
                    .from('hermes_agent_jobs')
                    .select('status, error')
                    .eq('job_id', jobId)
                    .single()

                if (data?.status === 'completed') {
                    setJob(prev => ({ ...(prev || {}), status: 'completed', status_message: 'Search complete!' }))
                    handleCompletedSearch()
                } else if (data?.status === 'failed') {
                    setJob(prev => ({ ...(prev || {}), status: 'failed', status_message: data.error }))
                    setError(data.error || 'Agent search failed')
                }
            }
            pollSearch()
            const pollInterval = setInterval(pollSearch, 5000)

            return () => {
                supabase.removeChannel(channel)
                clearInterval(pollInterval)
            }
        }
    }, [jobId, navigate, type, onManualComplete, manualSubtitle])

    // 2. Progress Simulation Logic
    useEffect(() => {
        const targetTime = type === 'audit' ? 120 : 180 // 3 minutes for search (agent takes time)
        const progressTimer = setInterval(() => {
            setProgressValue(prev => {
                if (prev >= 95) return 95
                const increment = 95 / targetTime
                return prev + increment * 0.5 + Math.random() * (increment * 0.5)
            })
        }, 1000)

        return () => clearInterval(progressTimer)
    }, [type])

    // 3. Step Rotation
    useEffect(() => {
        if (!job?.status_message) {
            const interval = setInterval(() => {
                setSimulatedStep(prev => (prev + 1) % loadingSteps.length)
            }, type === 'audit' ? 5000 : 2500)
            return () => clearInterval(interval)
        }
    }, [job?.status_message, type, loadingSteps.length])

    // 4. Background Task Sync (Fail-safe)
    const { getTask } = useBackgroundTasks()
    useEffect(() => {
        if (!jobId) return
        const task = getTask(jobId)
        if (task && task.status === 'completed' && type === 'search') {
            // Force manual completion for search if context says it's done
            if (onManualComplete) onManualComplete()
        }
        if (task && task.status === 'completed' && type === 'audit' && job?.status !== 'completed') {
            setJob(prev => ({ ...(prev || {}), status: 'completed' }))
        }
    }, [jobId, getTask, type, job?.status, onManualComplete])

    // 5. Handle manual completion
    useEffect(() => {
        if (type === 'search' && isManualComplete) {
            setProgressValue(100)
            const timer = setTimeout(() => {
                if (onManualComplete) onManualComplete()
            }, 800)
            return () => clearTimeout(timer)
        }
    }, [isManualComplete, type, onManualComplete])

    const isCompleted = type === 'audit' ? job?.status === 'completed' : isManualComplete
    const isFailed = type === 'audit' ? (job?.status === 'failed') : false
    const isFinished = isCompleted || isFailed

    useEffect(() => {
        if (error) toast.error(error)
    }, [error])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[3px] sm:p-6"
        >
            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="relative w-full max-w-lg"
            >
                <Card className="relative overflow-hidden bg-card">
                    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className={cn(
                                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                                isFailed ? 'bg-destructive/10 text-destructive' : isCompleted ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                            )}>
                                {isFailed ? <X className="h-5 w-5" /> : isCompleted ? <CheckCircle2 className="h-5 w-5" /> : type === 'audit' ? <Globe2 className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                            </span>
                            <div className="min-w-0">
                                <p className="eyebrow">{type === 'audit' ? 'Agent website audit' : 'Agent company discovery'}</p>
                                <h3 className="mt-1 text-lg font-bold tracking-tight">
                                    {isFailed ? 'Research failed' : isCompleted ? 'Evidence ready' : 'Research in progress'}
                                </h3>
                                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                                    {type === 'audit' ? job?.url || 'Preparing target…' : manualSubtitle}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                            {onMinimize && !isFinished && (
                                <Button variant="ghost" size="icon-sm" onClick={onMinimize} aria-label="Continue in background">
                                    <Minimize2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <CardContent className="p-6">
                        <div className="mb-6">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={job?.status_message || (isCompleted ? 'complete' : simulatedStep)}
                                        initial={{ opacity: 0, y: 3 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -3 }}
                                        transition={{ duration: 0.14 }}
                                        className={cn('text-sm font-semibold', isFailed && 'text-destructive')}
                                    >
                                        {isFailed ? error || 'The agent could not complete this research.' : isCompleted ? 'The result has been returned to your workspace.' : job?.status_message || loadingSteps[simulatedStep]}
                                    </motion.p>
                                </AnimatePresence>
                                <span className="font-mono text-[11px] text-muted-foreground">{Math.round(isFinished ? 100 : progressValue)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                    className={cn('h-full rounded-full', isFailed ? 'bg-destructive' : isCompleted ? 'bg-success' : 'bg-info')}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${isFinished ? 100 : progressValue}%` }}
                                    transition={{ duration: 0.35 }}
                                />
                            </div>
                            {!isFinished && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Progress is an estimate. The activity message above is returned by the live job when available.</p>}
                        </div>

                        <div className="evidence-rail">
                            {loadingSteps.map((step, index) => {
                                const complete = isCompleted || index < simulatedStep
                                const active = !isFinished && index === simulatedStep
                                return (
                                    <div key={step} className="relative pb-4 pl-7 last:pb-0">
                                        <span className={cn(
                                            'absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full border bg-card text-muted-foreground',
                                            complete && 'border-success bg-success text-white',
                                            active && 'border-info bg-info text-white'
                                        )}>
                                            {complete ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                        </span>
                                        <p className={cn('text-sm', (complete || active) ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{step}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {isCompleted && type === 'audit' && (
                            <Button onClick={() => navigate(`/report/${jobId}`)} className="mt-6 w-full">
                                Open audit report
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    )
}
