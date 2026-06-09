import { spawnSync } from 'node:child_process'

function extractJson(text) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Hermes returned empty output')
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`Hermes output did not contain a JSON object: ${trimmed.slice(0, 500)}`)
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1))
}

function normalizePayload(payload) {
  const status = payload.status || 'success'
  const results = Array.isArray(payload.results) ? payload.results : []

  return {
    status,
    error: payload.error || null,
    results: results.filter((result) => {
      return result &&
        typeof result === 'object' &&
        (result.website || result.url) &&
        (result.company_name || result.companyName)
    }),
  }
}

try {
  const job = JSON.parse(process.env.YOURI_HERMES_JOB || '{}')
  const prompt = job.prompt

  if (!prompt) {
    throw new Error('YOURI_HERMES_JOB.prompt is required')
  }

  const wrapperPrompt = `${prompt}

WRAPPER MODE OVERRIDE:
You are running inside a wrapper service. Do not call, curl, fetch, POST to, or otherwise contact any callback URL.
Do not ask for callback tokens. Do not mention callback delivery.
Your only job is to perform the research and print the final strict JSON object to stdout.
The wrapper service will handle the callback to Supabase after reading your JSON.

Output strict JSON only in this exact top-level shape:
{
  "status": "success" | "partial" | "failure",
  "error": null | "reason",
  "results": [
    {
      "company_name": "string",
      "website": "https://example.com",
      "company_description": "string",
      "category": "string",
      "country": "Netherlands",
      "shipping_evidence": "string",
      "revenue_evidence": "string",
      "revenue_estimate": "string",
      "evidence_urls": ["https://example.com"]
    }
  ]
}`

  const result = spawnSync(
    'hermes',
    [
      '--ignore-rules',
      '--toolsets',
      process.env.HERMES_TOOLSETS || 'browser,terminal,code_execution',
      '--oneshot',
      wrapperPrompt,
    ],
    {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 10,
    }
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `Hermes exited with status ${result.status}`)
  }

  const parsed = extractJson(result.stdout)
  console.log(JSON.stringify(normalizePayload(parsed)))
} catch (error) {
  console.log(JSON.stringify({
    status: 'failure',
    error: error instanceof Error ? error.message : String(error),
    results: [],
  }))
}
