import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type TaskType = 'audit' | 'search'
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface BackgroundTask {
    id: string
    type: TaskType
    status: TaskStatus
    title: string
    subtitle?: string
    progress: number
    statusMessage?: string
    createdAt: Date
}

interface BackgroundTasksContextType {
    tasks: BackgroundTask[]
    addTask: (task: Omit<BackgroundTask, 'createdAt'>) => void
    updateTask: (id: string, updates: Partial<BackgroundTask>) => void
    removeTask: (id: string) => void
    getTask: (id: string) => BackgroundTask | undefined
    hasActiveTasks: boolean
    activeTaskCount: number
}

const BackgroundTasksContext = createContext<BackgroundTasksContextType | null>(null)

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<BackgroundTask[]>([])
    const subscriptions = useRef<Record<string, any>>({})

    const addTask = useCallback((task: Omit<BackgroundTask, 'createdAt'>) => {
        setTasks(prev => [...prev, { ...task, createdAt: new Date() }])
    }, [])

    const updateTask = useCallback((id: string, updates: Partial<BackgroundTask>) => {
        setTasks(prev => prev.map(task =>
            task.id === id ? { ...task, ...updates } : task
        ))
    }, [])

    const removeTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(task => task.id !== id))
        // Cleanup subscription immediately if removed
        if (subscriptions.current[id]) {
            supabase.removeChannel(subscriptions.current[id])
            delete subscriptions.current[id]
        }
    }, [])

    const getTask = useCallback((id: string) => {
        return tasks.find(task => task.id === id)
    }, [tasks])

    // Realtime Subscription Manager
    useEffect(() => {
        const activeTasks = tasks.filter(t => t.status === 'processing')

        // 1. Subscribe to new tasks
        activeTasks.forEach(task => {
            if (!subscriptions.current[task.id]) {
                const channelName = task.type === 'audit'
                    ? `job-status-${task.id}`
                    : `search-status-${task.id}`

                console.log(`Subscribing to channel: ${channelName} for task:`, task.id)

                const channel = supabase
                    .channel(channelName)
                    .on('broadcast', { event: 'status_update' }, ({ payload }) => {
                        console.log(`Background task ${task.id} received broadcast:`, payload)
                        updateTask(task.id, {
                            statusMessage: payload.message,
                            // If event says complete, update status too (optional, usually DB event covers this)
                            status: payload.status === 'completed' ? 'completed' :
                                payload.status === 'failed' ? 'failed' : 'processing'
                        })
                    })

                // Only listen to postgres changes for audit tasks (they have jobs table entries)
                if (task.type === 'audit') {
                    channel.on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'jobs',
                        filter: `id=eq.${task.id}`
                    }, (payload) => {
                        const newJob = payload.new as any
                        if (newJob.status === 'completed' || newJob.status === 'failed') {
                            updateTask(task.id, {
                                status: newJob.status,
                                statusMessage: newJob.status === 'completed' ? 'Analysis Complete' : 'Analysis Failed'
                            })
                        }
                    })
                } else if (task.type === 'search') {
                    // For search tasks, add a timeout to auto-complete them if no broadcast is received
                    // This handles cases where the broadcast was missed or failed
                    setTimeout(() => {
                        const currentTask = tasks.find(t => t.id === task.id)
                        if (currentTask && currentTask.status === 'processing') {
                            console.log(`Auto-completing search task ${task.id} after timeout`)
                            updateTask(task.id, {
                                status: 'completed',
                                progress: 100,
                                statusMessage: 'Search completed (auto-detected)'
                            })
                        }
                    }, 60000) // 1 minute timeout
                }

                channel.subscribe()

                subscriptions.current[task.id] = channel
            }
        })

        // 2. Unsubscribe from finished/inactive tasks
        Object.keys(subscriptions.current).forEach(id => {
            if (!activeTasks.find(t => t.id === id)) {
                // Task is no longer processing (completed, failed, or removed)
                // We keep subscription for a moment or remove? 
                // If it's completed, we stop listening.
                supabase.removeChannel(subscriptions.current[id])
                delete subscriptions.current[id]
            }
        })

    }, [tasks, updateTask]) // Re-run when tasks list changes (status changes handled by creating new reference in updateTask?)
    // Note: setTasks(prev => ...) doesn't trigger effect on 'tasks' dependency unless 'tasks' value changes. 
    // updateTask updates 'tasks' state, so this Effect runs.

    // Polling Fail-safe (Every 15 seconds, check status of active tasks in DB)
    useEffect(() => {
        const activeAudits = tasks.filter(t => t.type === 'audit' && t.status === 'processing')
        if (activeAudits.length === 0) return

        const pollTimer = setInterval(async () => {
            for (const task of activeAudits) {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('status, status_message')
                    .eq('id', task.id)
                    .single()

                if (data && (data.status === 'completed' || data.status === 'failed')) {
                    updateTask(task.id, {
                        status: data.status,
                        statusMessage: data.status_message || (data.status === 'completed' ? 'Audit Complete' : 'Audit Failed')
                    })
                }
            }
        }, 15000)

        return () => clearInterval(pollTimer)
    }, [tasks, updateTask])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(subscriptions.current).forEach(channel => supabase.removeChannel(channel))
        }
    }, [])

    const _activeTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending')
    const hasActiveTasks = _activeTasks.length > 0
    const activeTaskCount = _activeTasks.length

    return (
        <BackgroundTasksContext.Provider value={{
            tasks,
            addTask,
            updateTask,
            removeTask,
            getTask,
            hasActiveTasks,
            activeTaskCount
        }}>
            {children}
        </BackgroundTasksContext.Provider>
    )
}

export function useBackgroundTasks() {
    const context = useContext(BackgroundTasksContext)
    if (!context) {
        throw new Error('useBackgroundTasks must be used within a BackgroundTasksProvider')
    }
    return context
}
