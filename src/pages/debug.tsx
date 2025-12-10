import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Check, X, Loader2 } from 'lucide-react'

type TestResult = {
    name: string
    status: 'idle' | 'testing' | 'success' | 'error'
    message?: string
    details?: any
}

export function DebugPage() {
    const [results, setResults] = useState<TestResult[]>([
        { name: 'Environment Variables', status: 'idle' },
        { name: 'Supabase Connection', status: 'idle' },
        { name: 'N8N Webhook', status: 'idle' },
    ])

    const updateResult = (index: number, update: Partial<TestResult>) => {
        setResults(prev => prev.map((r, i) => (i === index ? { ...r, ...update } : r)))
    }

    const testEnvironmentVariables = () => {
        updateResult(0, { status: 'testing' })

        const envVars = {
            VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
            VITE_N8N_WEBHOOK_URL: import.meta.env.VITE_N8N_WEBHOOK_URL,
            VITE_SERP_API_KEY: import.meta.env.VITE_SERP_API_KEY,
            VITE_FIRECRAWL_API_KEY: import.meta.env.VITE_FIRECRAWL_API_KEY,
        }

        const missing = Object.entries(envVars)
            .filter(([_, value]) => !value)
            .map(([key]) => key)

        if (missing.length > 0) {
            updateResult(0, {
                status: 'error',
                message: `Missing: ${missing.join(', ')}`,
                details: envVars,
            })
        } else {
            updateResult(0, {
                status: 'success',
                message: 'All environment variables are set',
                details: {
                    ...envVars,
                    VITE_SUPABASE_ANON_KEY: '***hidden***',
                    VITE_SERP_API_KEY: '***hidden***',
                    VITE_FIRECRAWL_API_KEY: '***hidden***',
                },
            })
        }
    }

    const testSupabaseConnection = async () => {
        updateResult(1, { status: 'testing' })

        if (!isSupabaseConfigured) {
            updateResult(1, {
                status: 'error',
                message: 'Supabase is not configured',
            })
            return
        }

        try {
            // Try a simple query to test connection
            const { data, error } = await supabase.from('jobs').select('count').limit(1)

            if (error) {
                updateResult(1, {
                    status: 'error',
                    message: error.message,
                    details: error,
                })
            } else {
                updateResult(1, {
                    status: 'success',
                    message: 'Successfully connected to Supabase',
                    details: data,
                })
            }
        } catch (error: any) {
            updateResult(1, {
                status: 'error',
                message: error.message || 'Failed to fetch',
                details: error,
            })
        }
    }

    const testN8NWebhook = async () => {
        updateResult(2, { status: 'testing' })

        const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL

        if (!webhookUrl) {
            updateResult(2, {
                status: 'error',
                message: 'N8N webhook URL is not configured',
            })
            return
        }

        try {
            // Try a simple HEAD or OPTIONS request first
            const response = await fetch(webhookUrl, {
                method: 'OPTIONS',
            })

            updateResult(2, {
                status: 'success',
                message: `N8N endpoint is reachable (${response.status})`,
                details: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                },
            })
        } catch (error: any) {
            updateResult(2, {
                status: 'error',
                message: error.message || 'Failed to fetch',
                details: error,
            })
        }
    }

    const runAllTests = async () => {
        testEnvironmentVariables()
        await new Promise(resolve => setTimeout(resolve, 100))
        await testSupabaseConnection()
        await new Promise(resolve => setTimeout(resolve, 100))
        await testN8NWebhook()
    }

    const getStatusIcon = (status: TestResult['status']) => {
        switch (status) {
            case 'testing':
                return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            case 'success':
                return <Check className="h-5 w-5 text-green-500" />
            case 'error':
                return <X className="h-5 w-5 text-red-500" />
            default:
                return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        }
    }

    return (
        <div className="container max-w-4xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Connection Debugger</h1>
                <p className="text-muted-foreground">
                    Test your environment variables and service connections
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex gap-2">
                    <Button onClick={runAllTests}>Run All Tests</Button>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Reset
                    </Button>
                </div>

                {results.map((result) => (
                    <Card key={result.name}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{result.name}</CardTitle>
                                {getStatusIcon(result.status)}
                            </div>
                            {result.message && (
                                <CardDescription className={result.status === 'error' ? 'text-red-500' : ''}>
                                    {result.message}
                                </CardDescription>
                            )}
                        </CardHeader>
                        {result.details && (
                            <CardContent>
                                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64">
                                    {JSON.stringify(result.details, null, 2)}
                                </pre>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    )
}
