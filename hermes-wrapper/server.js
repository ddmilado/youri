import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT || 3001)
const HERMES_WEBHOOK_SECRET = process.env.HERMES_WEBHOOK_SECRET || ''
const HERMES_CALLBACK_TOKEN = process.env.HERMES_CALLBACK_TOKEN || ''
const RESEARCH_COMMAND = process.env.RESEARCH_COMMAND || ''

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, signature) {
  if (!HERMES_WEBHOOK_SECRET) return true
  if (!signature?.startsWith('sha256=')) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', HERMES_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function postCallback(job, payload) {
  const callbackUrl = job.callback_url
  const callbackToken = job.callback_token || HERMES_CALLBACK_TOKEN

  if (!callbackUrl) {
    throw new Error('callback_url is required')
  }

  if (!callbackToken) {
    throw new Error('callback_token or HERMES_CALLBACK_TOKEN is required')
  }

  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(job.callback_headers || {}),
      Authorization: `Bearer ${callbackToken}`,
    },
    body: JSON.stringify(payload),
  })

  const responseBody = await response.text()
  console.log(`callback POST ${response.status} ${responseBody}`)

  if (!response.ok) {
    throw new Error(`callback failed: ${response.status} ${responseBody}`)
  }
}

async function runResearch(job) {
  if (!RESEARCH_COMMAND) {
    throw new Error('RESEARCH_COMMAND is not configured. Wire this wrapper to Hermes CLI/API or another research worker.')
  }

  const { spawn } = await import('node:child_process')

  return await new Promise((resolve, reject) => {
    const child = spawn(RESEARCH_COMMAND, {
      shell: true,
      env: {
        ...process.env,
        YOURI_HERMES_JOB: JSON.stringify(job),
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `research command exited with code ${code}`))
        return
      }

      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`research command did not return JSON: ${stdout || stderr}`))
      }
    })
  })
}

async function processJob(job) {
  try {
    console.log(`accepted job search_id=${job.search_id || 'unknown'}`)
    const researchPayload = await runResearch(job)

    await postCallback(job, {
      search_id: job.search_id,
      user_id: job.user_id,
      search_query: job.search_query,
      status: researchPayload.status || 'success',
      error: researchPayload.error || null,
      results: researchPayload.results || [],
      creator_name: job.creator_name || null,
      creator_email: job.creator_email || null,
    })
  } catch (error) {
    console.error('job failed:', error)

    try {
      await postCallback(job, {
        search_id: job.search_id,
        user_id: job.user_id,
        search_query: job.search_query,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        results: [],
        creator_name: job.creator_name || null,
        creator_email: job.creator_email || null,
      })
    } catch (callbackError) {
      console.error('failure callback failed:', callbackError)
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'youri-hermes-wrapper' })
    return
  }

  if (req.method !== 'POST' || req.url !== '/webhooks/research') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  try {
    const rawBody = await readBody(req)
    const signature = req.headers['x-hub-signature-256']

    if (!verifySignature(rawBody, Array.isArray(signature) ? signature[0] : signature)) {
      sendJson(res, 401, { error: 'Invalid signature' })
      return
    }

    const job = JSON.parse(rawBody)

    setTimeout(() => {
      processJob(job).catch((error) => console.error('background job error:', error))
    }, 0)

    sendJson(res, 202, { success: true, status: 'accepted' })
  } catch (error) {
    sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, () => {
  console.log(`Youri Hermes wrapper listening on http://localhost:${PORT}`)
})
