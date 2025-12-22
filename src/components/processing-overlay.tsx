import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Database } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Job = Database['public']['Tables']['jobs']['Row']

interface ProcessingOverlayProps {
    jobId?: string
    onClose: () => void
    type?: 'audit' | 'search'
    manualSubtitle?: string
    isManualComplete?: boolean
    onManualComplete?: () => void
}

export function ProcessingOverlay({
    jobId,
    onClose,
    type = 'audit',
    manualSubtitle,
    isManualComplete,
    onManualComplete
}: ProcessingOverlayProps) {
    const navigate = useNavigate()
    const [job, setJob] = useState<Job | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [progressValue, setProgressValue] = useState(0)
    const [simulatedStep, setSimulatedStep] = useState(0)

    const auditSteps = [
        'Initializing AI engine...',
        'Scanning website structure...',
        'Analyzing legal compliance...',
        'Checking UX & mobile responsiveness...',
        'Compiling final deep audit report...',
    ]

    const searchSteps = [
        'Deploying discovery crawlers...',
        'Searching Global & German indices...',
        'Filtering for high-quality leads...',
        'Extracting company profiles...',
        'Finalizing lead discovery batch...',
    ]

    const loadingSteps = type === 'audit' ? auditSteps : searchSteps

    // 1. Job Monitoring & Realtime Subscriptions
    useEffect(() => {
        if (!jobId) return

        if (type === 'audit') {
            const fetchJob = async (silent = false) => {
                const { data, error: jobError } = await supabase.from('jobs').select('*').eq('id', jobId).single()
                if (jobError) {
                    if (!silent) {
                        console.error('Error fetching job:', jobError)
                        setError('Could not find this analysis job.')
                    }
                    return
                }
                const updatedJob = data as Job
                setJob(updatedJob)

                if (updatedJob.status === 'completed') {
                    toast.success('Analysis complete!')
                    navigate(`/report/${jobId}`, { replace: true })
                }
                if (updatedJob.status === 'failed') {
                    setError('The analysis failed. Please try again or check the URL.')
                }
            }

            fetchJob()

            const channel = supabase
                .channel(`job-status-${jobId}`, {
                    config: { broadcast: { self: true } },
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (payload) => {
                    const updatedJob = payload.new as Job
                    setJob(prev => ({ ...prev, ...updatedJob }))
                    if (updatedJob.status === 'completed') {
                        navigate(`/report/${jobId}`, { replace: true })
                    }
                })
                .on('broadcast', { event: 'status_update' }, ({ payload }) => {
                    setJob(prev => prev ? { ...prev, status_message: payload.message, status: payload.status } : null)
                })
                .subscribe()

            const pollInterval = setInterval(() => fetchJob(true), 4000)

            return () => {
                supabase.removeChannel(channel)
                clearInterval(pollInterval)
            }
        }

        if (type === 'search') {
            const channel = supabase
                .channel(`search-status-${jobId}`)
                .on('broadcast', { event: 'status_update' }, ({ payload }) => {
                    setJob(prev => ({
                        ...prev,
                        status_message: payload.message,
                        status: payload.status
                    } as any))
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [jobId, navigate, type])

    // 2. Progress Simulation Logic
    useEffect(() => {
        const targetTime = type === 'audit' ? 120 : 15
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

    // 4. Handle manual completion
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

    if (error) {
        toast.error(error)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-[12px] bg-slate-950/40"
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="w-full max-w-md relative"
            >
                <Card className="relative border-emerald-500/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)] bg-white/80 dark:bg-slate-900/80 border-2 overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />

                    <CardContent className="p-8 flex flex-col items-center text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                                <Sparkles className="h-6 w-6 text-white animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-4 w-full">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
                                    {isCompleted ? 'Finished' : (type === 'audit' ? 'Deep Audit' : 'Lead Discovery')}
                                </h3>
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                        {type === 'audit' ? job?.url?.replace('https://', '').replace('http://', '') : manualSubtitle}
                                    </span>
                                </div>
                            </div>

                            <div className="py-2">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={job?.status_message || (isCompleted ? 'complete' : simulatedStep)}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.05 }}
                                        className="min-h-[40px] flex items-center justify-center"
                                    >
                                        <p className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent leading-snug px-2">
                                            {isCompleted ? 'Complete' : (job?.status_message || loadingSteps[simulatedStep])}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <div className="w-full space-y-2">
                                <div className="relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                                        initial={{ width: '0%' }}
                                        animate={{ width: isCompleted ? '100%' : `${progressValue}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                                {!isCompleted && (
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                                        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 animate-pulse">
                                            Processing Squad Live
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isCompleted && type === 'audit' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="pt-6 w-full"
                            >
                                <Button
                                    onClick={() => navigate(`/report/${jobId}`)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-[0_10px_30px_-10px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Enter Report Explorer
                                </Button>
                            </motion.div>
                        )}
                    </CardContent>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 group"
                    >
                        <X className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </Card>
            </motion.div>
        </motion.div>
    )
}
