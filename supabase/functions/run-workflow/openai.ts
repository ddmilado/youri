// OpenAI API utilities for Supabase Edge Functions

// Rate limiter for OpenAI API calls
export class OpenAIRateLimiter {
    private lastCallTime = 0
    private callQueue: Array<() => void> = []
    private isProcessing = false
    private tokensUsedInWindow = 0
    private windowStartTime = Date.now()
    private readonly minInterval = 200
    private readonly maxTokensPerMinute = 400000
    private readonly windowDuration = 60000

    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.callQueue.push(resolve)
            this.processQueue()
        })
    }

    private async processQueue() {
        if (this.isProcessing || this.callQueue.length === 0) return

        this.isProcessing = true

        while (this.callQueue.length > 0) {
            const now = Date.now()

            if (now - this.windowStartTime >= this.windowDuration) {
                this.tokensUsedInWindow = 0
                this.windowStartTime = now
            }

            if (this.tokensUsedInWindow > this.maxTokensPerMinute * 0.8) {
                const waitTime = this.windowDuration - (now - this.windowStartTime)
                if (waitTime > 0) {
                    console.log(`Token limit approaching: waiting ${waitTime}ms`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    this.tokensUsedInWindow = 0
                    this.windowStartTime = Date.now()
                }
            }

            const timeSinceLastCall = now - this.lastCallTime
            if (timeSinceLastCall < this.minInterval) {
                await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall))
            }

            const resolve = this.callQueue.shift()
            if (resolve) {
                this.lastCallTime = Date.now()
                this.tokensUsedInWindow += 15000
                resolve()
            }
        }

        this.isProcessing = false
    }
}

export const openaiRateLimiter = new OpenAIRateLimiter()

export async function callOpenAI(
    apiKey: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini',
    responseFormat?: { type: 'json_object' | 'text' },
    temperature: number = 0.7,
    maxTokens: number = 4000,
    retries: number = 2
): Promise<string> {

    await openaiRateLimiter.acquire()

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ]

    const requestBody: any = {
        model: model,
        messages,
        temperature,
        max_tokens: maxTokens
    }

    if (responseFormat) {
        requestBody.response_format = responseFormat
        if (responseFormat.type === 'json_object' && !systemPrompt.includes('JSON')) {
            messages[0].content = systemPrompt + "\n\nIMPORTANT: You must output valid JSON."
        }
    }

    try {
        console.log(`Calling OpenAI with model: ${model} (max_tokens: ${maxTokens})`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000)

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            const error = await response.text()
            console.error(`OpenAI API error [${response.status}]: ${error}`)

            if (retries > 0 && (response.status === 429 || response.status >= 500)) {
                console.log(`Retrying OpenAI call... (${retries} attempts left)`)
                await new Promise((resolve) => setTimeout(resolve, 2000))
                return callOpenAI(apiKey, systemPrompt, conversationHistory, model, responseFormat, temperature, maxTokens, retries - 1)
            }
            throw new Error(`OpenAI API Error: ${response.statusText} - ${error}`)
        }

        const data = await response.json()
        let content = data.choices[0].message.content

        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '')
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '')
        }

        return content.trim()

    } catch (error) {
        if (retries > 0) {
            console.warn(`OpenAI call failed, retrying... (${retries} left)`, error)
            await new Promise((resolve) => setTimeout(resolve, 3000))
            return callOpenAI(apiKey, systemPrompt, conversationHistory, model, responseFormat, temperature, maxTokens, retries - 1)
        }
        throw error
    }
}
