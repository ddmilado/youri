import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' ')
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI Embedding Error: ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
}

export function chunkText(text: string, maxChars: number = 1000): string[] {
    if (!text || text.length === 0) return []

    const chunks: string[] = []
    let currentChunk = ''

    // Split by paragraphs first to keep context together
    const paragraphs = text.split(/\n\s*\n/)

    for (const paragraph of paragraphs) {
        if ((currentChunk.length + paragraph.length) > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim())
            currentChunk = ''
        }

        // If a single paragraph is too huge, split it by sentences
        if (paragraph.length > maxChars) {
            const sentences = paragraph.match(/[^.!?]+[.!?]+|\s+/g) || [paragraph]
            for (const sentence of sentences) {
                if ((currentChunk.length + sentence.length) > maxChars && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim())
                    currentChunk = ''
                }
                currentChunk += sentence
            }
        } else {
            currentChunk += paragraph + '\n\n'
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
    }

    return chunks
}
