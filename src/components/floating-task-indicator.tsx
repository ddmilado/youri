import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, X, ChevronUp, ChevronDown, Sparkles, Search } from 'lucide-react'
import { useBackgroundTasks, type BackgroundTask } from '@/contexts/background-tasks-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FloatingTaskIndicator() {
    const { tasks, hasActiveTasks, activeTaskCount, removeTask } = useBackgroundTasks()
    const [isExpanded, setIsExpanded] = useState(false)
    const navigate = useNavigate()

    // Only show if there are tasks
    if (tasks.length === 0) return null

    const completedTasks = tasks.filter(t => t.status === 'completed')

    const handleTaskClick = (task: BackgroundTask) => {
        if (task.status === 'completed') {
            if (task.type === 'audit') {
                navigate(`/report/${task.id}`)
            } else {
                navigate('/jobs')
            }
            removeTask(task.id)
        }
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Background Tasks</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsExpanded(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="max-h-64 overflow-auto">
                            {tasks.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    No background tasks
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {tasks.map(task => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                                task.status === 'completed' && "cursor-pointer"
                                            )}
                                            onClick={() => handleTaskClick(task)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg",
                                                    task.status === 'processing' && "bg-emerald-100 dark:bg-emerald-900/30",
                                                    task.status === 'completed' && "bg-green-100 dark:bg-green-900/30",
                                                    task.status === 'failed' && "bg-red-100 dark:bg-red-900/30",
                                                    task.status === 'pending' && "bg-slate-100 dark:bg-slate-800"
                                                )}>
                                                    {task.status === 'processing' ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                                    ) : task.status === 'completed' ? (
                                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                                    ) : task.type === 'audit' ? (
                                                        <Sparkles className="h-4 w-4 text-slate-500" />
                                                    ) : (
                                                        <Search className="h-4 w-4 text-slate-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{task.title}</p>
                                                    {task.subtitle && (
                                                        <p className="text-xs text-muted-foreground truncate">{task.subtitle}</p>
                                                    )}
                                                    {task.statusMessage && task.status === 'processing' && (
                                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                                            {task.statusMessage}
                                                        </p>
                                                    )}
                                                    {task.status === 'completed' && task.type === 'audit' && (
                                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                            Click to view report →
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removeTask(task.id)
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            {task.status === 'processing' && (
                                                <div className="mt-2 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-500"
                                                        style={{ width: `${task.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Badge */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-colors",
                    hasActiveTasks
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : completedTasks.length > 0
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-slate-600 text-white hover:bg-slate-700"
                )}
            >
                {hasActiveTasks ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">{activeTaskCount} running</span>
                    </>
                ) : completedTasks.length > 0 ? (
                    <>
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{completedTasks.length} done</span>
                    </>
                ) : (
                    <>
                        <span className="text-sm font-medium">{tasks.length} tasks</span>
                    </>
                )}
                {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                ) : (
                    <ChevronUp className="h-4 w-4" />
                )}
            </motion.button>
        </div>
    )
}
