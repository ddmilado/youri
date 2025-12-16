import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-2xl mx-auto">
                    <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-6 w-6" />
                                Something went wrong
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-sm text-muted-foreground">
                                An error occurred while rendering this page.
                            </p>
                            <pre className="bg-black/10 dark:bg-black/30 p-4 rounded-md text-xs font-mono overflow-auto mb-4">
                                {this.state.error?.message}
                                {'\n\n'}
                                {this.state.error?.stack}
                            </pre>
                            <Button
                                onClick={() => window.location.reload()}
                                variant="outline"
                                className="border-red-200 hover:bg-red-100 dark:hover:bg-red-900/20"
                            >
                                Reload Page
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
