import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT || 3001)
const HERMES_WEBHOOK_SECRET = process.env.HERMES_WEBHOOK_SECRET || ''
const HERMES_CALLBACK_TOKEN = process.env.HERMES_CALLBACK_TOKEN || ''
const HERMES_JOB_COMMAND = process.env.HERMES_JOB_COMMAND || 'node ./hermes-job-command.js'
const MAX_CONCURRENT_JOBS = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 2))
const CALLBACK_ATTEMPTS = Math.max(1, Number(process.env.CALLBACK_ATTEMPTS || 3))
const allowedJobTypes = new Set(['keyword_search', 'url_audit'])
let activeJobs = 0
const pendingJobs = []

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

  if (signature.length !== expected.length) return false
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

  let lastError
  for (let attempt = 1; attempt <= CALLBACK_ATTEMPTS; attempt++) {
    try {
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
      console.log(`callback POST ${response.status} attempt=${attempt} ${responseBody}`)
      if (response.ok) return
      lastError = new Error(`callback failed: ${response.status} ${responseBody}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < CALLBACK_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
    }
  }

  throw lastError || new Error('callback failed')
}

async function runHermesJob(job) {
  const { spawn } = await import('node:child_process')
  const childEnvironment = { ...process.env }
  delete childEnvironment.HERMES_WEBHOOK_SECRET
  delete childEnvironment.HERMES_CALLBACK_TOKEN
  const agentJob = {
    job_id: job.job_id,
    job_type: job.job_type,
    prompt: job.prompt,
    metadata: job.metadata || {},
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(HERMES_JOB_COMMAND, {
      shell: true,
      env: {
        ...childEnvironment,
        YOURI_HERMES_JOB: JSON.stringify(agentJob),
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
    console.log(`running Hermes job id=${job.job_id} type=${job.job_type}`)
    const resultPayload = await runHermesJob(job)

    await postCallback(job, {
      job_id: job.job_id,
      job_type: job.job_type,
      user_id: job.user_id,
      status: resultPayload.status || 'success',
      error: resultPayload.error || null,
      results: resultPayload.results || [],
      report: resultPayload.report || null,
      run_id: resultPayload.run_id || null,
      metadata: job.metadata || {},
    })
  } catch (error) {
    console.error('job failed:', error)

    try {
      await postCallback(job, {
        job_id: job.job_id,
        job_type: job.job_type,
        user_id: job.user_id,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        results: [],
        report: null,
        metadata: job.metadata || {},
      })
    } catch (callbackError) {
      console.error('failure callback failed:', callbackError)
    }
  }
}

function validateJob(job) {
  if (!job || typeof job !== 'object') throw new Error('JSON job body is required')
  if (!job.job_id || typeof job.job_id !== 'string') throw new Error('job_id is required')
  if (!allowedJobTypes.has(job.job_type)) throw new Error('job_type must be keyword_search or url_audit')
  if (!job.user_id || typeof job.user_id !== 'string') throw new Error('user_id is required')
  if (!job.prompt || typeof job.prompt !== 'string') throw new Error('prompt is required')
  if (!job.callback_url || typeof job.callback_url !== 'string') throw new Error('callback_url is required')
  const callbackUrl = new URL(job.callback_url)
  if (callbackUrl.protocol !== 'https:' && callbackUrl.hostname !== 'localhost') {
    throw new Error('callback_url must use HTTPS')
  }
}

function drainQueue() {
  while (activeJobs < MAX_CONCURRENT_JOBS && pendingJobs.length > 0) {
    const job = pendingJobs.shift()
    activeJobs++
    processJob(job)
      .catch((error) => console.error('background job error:', error))
      .finally(() => {
        activeJobs--
        drainQueue()
      })
  }
}

function enqueueJob(job) {
  pendingJobs.push(job)
  drainQueue()
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'youri-hermes-wrapper',
      active_jobs: activeJobs,
      queued_jobs: pendingJobs.length,
      max_concurrent_jobs: MAX_CONCURRENT_JOBS,
    })
    return
  }

  if (req.method !== 'POST' || !['/jobs', '/webhooks/research'].includes(req.url)) {
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
    validateJob(job)
    enqueueJob(job)

    sendJson(res, 202, {
      success: true,
      status: 'accepted',
      job_id: job.job_id,
      job_type: job.job_type,
    })
  } catch (error) {
    sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) })
  }
})

if (!HERMES_WEBHOOK_SECRET || !HERMES_CALLBACK_TOKEN) {
  console.error('HERMES_WEBHOOK_SECRET and HERMES_CALLBACK_TOKEN are required')
  process.exit(1)
} else {
  server.listen(PORT, () => {
    console.log(`Youri Hermes wrapper listening on http://localhost:${PORT}`)
  })
}
