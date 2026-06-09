# Youri Hermes Wrapper

This wrapper gives the Supabase keyword-search function a reliable worker endpoint.

Why it exists:

- Hermes `/webhooks/research` can accept signed jobs.
- In webhook execution, Hermes could not reliably run tools or make outbound callback POSTs.
- This wrapper owns the callback step, so Supabase can receive success, partial, or failure payloads every time.

## Run Locally

```bash
cd hermes-wrapper
npm install
PORT=3001 \
HERMES_WEBHOOK_SECRET="same-secret-set-in-supabase" \
HERMES_CALLBACK_TOKEN="same-callback-token-set-in-supabase" \
RESEARCH_COMMAND="node ./sample-research-command.js" \
npm start
```

Expose it:

```bash
ngrok http 3001
```

Set Supabase to call:

```bash
supabase secrets set HERMES_WEBHOOK_URL="https://your-ngrok-url.ngrok-free.dev/webhooks/research" --project-ref szlepolifltozkkrqudq
supabase secrets set HERMES_WEBHOOK_SECRET="same-secret-set-in-wrapper" --project-ref szlepolifltozkkrqudq
```

## Research Command Contract

The wrapper runs `RESEARCH_COMMAND` with the full Supabase job JSON in:

```txt
YOURI_HERMES_JOB
```

The command must print strict JSON to stdout:

```json
{
  "status": "success",
  "results": [
    {
      "company_name": "Company Name",
      "website": "https://example.com",
      "company_description": "One sentence.",
      "category": "supplements",
      "country": "Netherlands",
      "shipping_evidence": "Ships outside the Netherlands.",
      "revenue_evidence": "Public scale signals indicate EUR 500k+.",
      "revenue_estimate": "EUR 500k+ indicated",
      "evidence_urls": ["https://example.com/shipping"]
    }
  ]
}
```

If the command fails or returns invalid JSON, the wrapper sends a failure callback to Supabase.

## Using Hermes CLI

If the `hermes` CLI is available on the machine running the wrapper, use:

```bash
PORT=3001 \
HERMES_WEBHOOK_SECRET="same-secret-set-in-supabase" \
HERMES_CALLBACK_TOKEN="same-callback-token-set-in-supabase" \
RESEARCH_COMMAND="node ./hermes-research-command.js" \
npm start
```

The script reads `YOURI_HERMES_JOB.prompt`, runs:

```bash
hermes --ignore-rules --toolsets browser,terminal,code_execution --oneshot "$prompt"
```

and expects Hermes to print the strict JSON object requested by the prompt.

You can override toolsets if your Hermes install uses different names:

```bash
HERMES_TOOLSETS="browser,terminal,code_execution"
```
