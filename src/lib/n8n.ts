export type N8nWorkflowPayload = {
    targetCountry: string
    targetUrl: string
    searchKeywords: string
    siteOperator: string
    serpApiKey: string
    firecrawlApiKey: string
    jobId: string
    userId: string
}

export type N8nWorkflowResponse = {
    success: boolean
    executionId?: string
    message?: string
}

/**
 * Triggers the n8n lead discovery workflow
 * @param payload - The workflow payload containing target country, keywords, and/or URL
 * @returns Promise with the workflow execution response
 */
export async function triggerWorkflow(
    payload: {
        targetCountry: string
        targetUrl?: string
        searchKeywords?: string
        siteOperator?: string
        userId: string
        jobId?: string
    }
): Promise<N8nWorkflowResponse> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
    const serpApiKey = import.meta.env.VITE_SERP_API_KEY
    const firecrawlApiKey = import.meta.env.VITE_FIRECRAWL_API_KEY

    if (!webhookUrl) {
        throw new Error('N8N webhook URL is not configured')
    }

    if (!serpApiKey) {
        throw new Error('SerpApi key is not configured')
    }

    if (!firecrawlApiKey) {
        throw new Error('Firecrawl API key is not configured')
    }

    // Generate a jobId if not provided
    const jobId = payload.jobId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Build payload with empty strings for optional fields (as required by n8n)
    const fullPayload: N8nWorkflowPayload = {
        targetCountry: payload.targetCountry,
        targetUrl: payload.targetUrl || '',
        searchKeywords: payload.searchKeywords || '',
        siteOperator: payload.siteOperator || '',
        serpApiKey,
        firecrawlApiKey,
        jobId,
        userId: payload.userId,
    }

    console.log('Triggering n8n workflow with payload:', {
        ...fullPayload,
        serpApiKey: '***hidden***',
        firecrawlApiKey: '***hidden***'
    })

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fullPayload),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('N8N workflow error response:', errorText)
            throw new Error(`N8N workflow failed (${response.status}): ${response.statusText}`)
        }

        // Check if response has content
        const contentType = response.headers.get('content-type')
        let data: any = {}

        if (contentType && contentType.includes('application/json')) {
            const text = await response.text()
            if (text) {
                try {
                    data = JSON.parse(text)
                } catch (parseError) {
                    console.warn('Could not parse n8n response as JSON:', text)
                }
            }
        }

        console.log('N8N workflow response:', data)

        return {
            success: true,
            executionId: data.executionId || data.workflowId || response.headers.get('x-execution-id'),
            message: data.message || 'Workflow triggered successfully',
        }
    } catch (error) {
        console.error('Failed to trigger n8n workflow:', error)
        throw error instanceof Error ? error : new Error('Failed to trigger workflow')
    }
}
