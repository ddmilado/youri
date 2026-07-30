import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

interface WorkflowInput {
  input_as_text: string;
  user_id: string;
  job_id?: string;
  is_callback?: boolean;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function submitHermesJob(job: Record<string, unknown>): Promise<void> {
  const webhookUrl = Deno.env.get("HERMES_WEBHOOK_URL");
  const webhookSecret = Deno.env.get("HERMES_WEBHOOK_SECRET");
  if (!webhookUrl) throw new Error("HERMES_WEBHOOK_URL is not configured");
  if (!webhookSecret) {
    throw new Error("HERMES_WEBHOOK_SECRET is not configured");
  }

  const body = JSON.stringify(job);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${bytesToHex(signature)}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Hermes job submission failed: ${response.status} ${await response
        .text()}`,
    );
  }
}

function buildHermesAuditPrompt(targetUrl: string): string {
  return `You are Hermes, performing a live browser-based website audit for:
${targetUrl}

You must browse the live website. Open and inspect relevant pages before reaching conclusions. Do not report a missing feature or page merely because it was not visible on the homepage.

Audit objective:
Assess readiness for international customers, especially German and English-speaking buyers. Focus on linguistic quality, localization, legal/trust discoverability, shipping and returns clarity, and conversion risks.

Visit and verify where available:
- Homepage, navigation, footer, and important product/category pages.
- Language switcher, country selector, and locale-specific pages.
- German and English pages and any mixed-language templates.
- Shipping/delivery, returns/withdrawal, terms/AGB, privacy/GDPR, contact, Impressum/legal notice, FAQ, cart, and checkout flow.
- Trust signals, payment methods, social proof, and customer-service information.

Find and document:
- Grammar, spelling, unnatural phrasing, literal translation, language mixing, and inconsistent terminology.
- German-market readiness issues such as weak legal-page discoverability, unclear returns, unclear German shipping costs, missing local trust cues, or incomplete localization.
- Broken links and conversion risks caused by unclear or inconsistent content.
- Machine-translation signals and partially translated templates.

Evidence requirements:
- Every finding must name the exact page URL and page area.
- Include a short exact snippet where safe and available.
- Explain how the issue was verified and assign a confidence value from 0 to 1.
- Never claim something is absent unless you checked navigation, footer, likely direct URLs, and site search when available.
- Capture screenshot/evidence URLs when the browser tooling exposes them. Otherwise leave screenshotUrl out.
- Do not make a purchase, submit personal data, accept marketing, or perform destructive actions.

Scoring:
- Return an integer score from 0 to 100, where 100 means excellent international/German readiness.
- Base the score only on verified evidence.

Use these section titles when relevant:
- Executive Summary & Company Context
- Linguistic & Localization Errors
- German Market Trust & Legal Readiness
- Shipping, Returns & Checkout Clarity
- UX Conversion Trust Killers
- Priority Recommendations

Return structured JSON using the audit schema supplied by the wrapper.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let jobIdForFailure: string | undefined;
  let supabaseForFailure: any = null;
  try {
    const {
      input_as_text,
      user_id,
      job_id: providedJobId,
    } = await req.json() as WorkflowInput;

    if (!input_as_text?.trim()) throw new Error("input_as_text is required");
    if (!user_id) throw new Error("user_id is required");

    const urlMatch = input_as_text.match(/(https?:\/\/[^\s]+)/i);
    const targetUrl = normalizeUrl(urlMatch ? urlMatch[1] : input_as_text);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    supabaseForFailure = supabase;

    let jobId = providedJobId;
    if (!jobId) {
      let title = targetUrl;
      try {
        title = new URL(targetUrl).hostname;
      } catch {
        // Keep the normalized URL as the title.
      }
      const { data, error } = await supabase.from("jobs").insert({
        user_id,
        title,
        url: targetUrl,
        status: "pending",
        status_message: "Initializing Hermes audit...",
      }).select().single();
      if (error || !data) {
        throw new Error(
          `Failed to create job: ${error?.message || "unknown error"}`,
        );
      }
      jobId = data.id;
    }
    jobIdForFailure = jobId;

    const { data: currentJob, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status, status_message, raw_data")
      .eq("id", jobId)
      .eq("user_id", user_id)
      .single();
    if (jobError || !currentJob) {
      throw new Error(`Job not found: ${jobError?.message || jobId}`);
    }

    const rawData = currentJob.raw_data as Record<string, unknown> | null;
    if (rawData?.source === "hermes") {
      return new Response(
        JSON.stringify({
          success: currentJob.status !== "failed",
          job_id: jobId,
          phase: currentJob.status,
          message: currentJob.status_message || "Hermes audit is running.",
        }),
        { headers: corsHeaders },
      );
    }

    const metadata = { target_url: targetUrl };
    const { error: trackingError } = await supabase
      .from("hermes_agent_jobs")
      .upsert({
        job_id: jobId,
        job_type: "url_audit",
        user_id,
        status: "submitted",
        metadata,
      }, { onConflict: "job_id" });
    if (trackingError) {
      throw new Error(`Failed to track Hermes job: ${trackingError.message}`);
    }

    const { error: updateError } = await supabase.from("jobs").update({
      status: "processing",
      status_message: "Hermes is opening and auditing the website...",
      crawl_status: "completed",
      raw_data: {
        source: "hermes",
        target_url: targetUrl,
        submitted_at: new Date().toISOString(),
      },
    }).eq("id", jobId).eq("user_id", user_id);
    if (updateError) {
      throw new Error(`Failed to update audit job: ${updateError.message}`);
    }

    await submitHermesJob({
      job_id: jobId,
      job_type: "url_audit",
      user_id,
      prompt: buildHermesAuditPrompt(targetUrl),
      callback_url: `${
        Deno.env.get("SUPABASE_URL")
      }/functions/v1/hermes-callback`,
      metadata,
    });

    const channel = supabase.channel(`job-status-${jobId}`);
    await channel.send({
      type: "broadcast",
      event: "status_update",
      payload: {
        id: jobId,
        status: "processing",
        message:
          "Hermes is browsing the live website and preparing the audit...",
      },
    }, { httpSend: true }).catch((error: unknown) => {
      console.error("Could not broadcast Hermes audit status:", error);
    });
    await supabase.removeChannel(channel);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        phase: "hermes-audit",
        message: "Hermes URL audit started.",
      }),
      { status: 202, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Hermes audit submission error:", error);
    if (supabaseForFailure && jobIdForFailure) {
      await supabaseForFailure.from("jobs").update({
        status: "failed",
        status_message: `Hermes audit failed to start: ${
          error instanceof Error
            ? error.message.slice(0, 100)
            : String(error).slice(0, 100)
        }`,
      }).eq("id", jobIdForFailure);
    }
    return new Response(
      JSON.stringify({
        success: false,
        job_id: jobIdForFailure,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
