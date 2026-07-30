# Youri Hermes Worker

This service accepts signed jobs from Supabase, runs Hermes with browser tools on
the VPS, and sends normalized results to the `hermes-callback` Edge Function.

It supports:

- `keyword_search`: browse and verify companies matching a research request.
- `url_audit`: browse a website and return the existing Youri audit-report shape.

The React frontend never communicates with this service directly.

## 1. Prepare Hermes on the VPS

Install and configure the current Hermes Agent release, then verify its browser
tools:

```bash
hermes --version
hermes setup --portal
hermes setup tools
hermes chat --toolsets browser,web --query \
  "Open https://example.com and return its page title."
```

If you do not use Nous Portal, configure your chosen model provider and browser
backend before continuing.

## 2. Configure the worker

```bash
cd hermes-wrapper
npm install

export PORT=3001
export HERMES_WEBHOOK_SECRET="same-HMAC-secret-as-Supabase"
export HERMES_CALLBACK_TOKEN="same-callback-token-as-Supabase"
export HERMES_JOB_COMMAND="node ./hermes-job-command.js"
export HERMES_TOOLSETS="browser,web"
export MAX_CONCURRENT_JOBS=2
export CALLBACK_ATTEMPTS=3
export HERMES_JOB_TIMEOUT_MS=900000

npm start
```

`HERMES_IGNORE_RULES` defaults to false. Only enable it if you deliberately want
Hermes to ignore VPS-local agent rules.

## 3. Public endpoint

Put Caddy or Nginx in front of port 3001 and expose:

```text
POST https://hermes.example.com/jobs
GET  https://hermes.example.com/health
```

Use HTTPS. Do not expose port 3001 directly to the internet.

The health response includes active and queued job counts.

## 4. Supabase configuration

Apply `supabase/migrations/20260730_hermes_agent_jobs.sql`, either with
`supabase db push` or through the SQL editor.

Then configure:

```bash
supabase secrets set \
  HERMES_WEBHOOK_URL="https://hermes.example.com/jobs" \
  HERMES_WEBHOOK_SECRET="same-HMAC-secret-as-the-worker" \
  HERMES_CALLBACK_TOKEN="same-callback-token-as-the-worker"
```

Deploy:

```bash
supabase functions deploy keyword-search
supabase functions deploy run-workflow
supabase functions deploy hermes-callback --no-verify-jwt
```

The callback uses its own bearer token, so it must be reachable by the VPS and
is deployed without Supabase JWT verification.

## Job contract

Supabase sends:

```json
{
  "job_id": "uuid",
  "job_type": "keyword_search",
  "user_id": "uuid",
  "prompt": "task instructions",
  "callback_url": "https://project.supabase.co/functions/v1/hermes-callback",
  "metadata": {}
}
```

The body is authenticated using:

```text
X-Hub-Signature-256: sha256=<HMAC-SHA256 of the exact request body>
```

The worker returns `202` after validation and runs the job asynchronously.

## Production note

The current queue is in memory. It limits concurrency, but accepted jobs will be
lost if the Node process restarts. Before relying on it for unattended
production work, replace the in-memory queue with Redis/BullMQ, PostgreSQL, or
another durable queue.
