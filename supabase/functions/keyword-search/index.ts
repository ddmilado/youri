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
  search_id?: string;
  creator_name?: string;
  creator_email?: string;
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

function buildHermesKeywordPrompt(userRequest: string): string {
  return `You are Hermes, the web research agent for the Youri keyword-search workflow.

Research request:
${userRequest}

Use your browser and web tools to discover and verify companies matching the request. Do not rely only on search snippets: open the company's own website and inspect the relevant pages.

Unless the user specifies another number, return exactly 20 companies.

Default qualification rules:
1. The company is Dutch or based in the Netherlands.
2. It operates its own webshop or direct ecommerce storefront.
3. It ships outside the Netherlands.
4. Public evidence reasonably indicates at least EUR 500k annual revenue or equivalent commercial scale.
5. The returned URL is the company's own website, not a directory, article, social profile, marketplace, or aggregator.

For every company:
- Verify the official website.
- Visit shipping/delivery pages and quote or summarize international-shipping evidence.
- Capture defensible scale/revenue evidence. Never invent revenue.
- Include the URLs used as evidence.
- Exclude candidates that cannot be verified.
- Deduplicate by root domain.

Return structured JSON using the schema supplied by the wrapper.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let statusChannel: any = null;
  try {
    const {
      input_as_text,
      user_id,
      search_id,
      creator_name,
      creator_email,
    } = await req.json() as WorkflowInput;

    const query = input_as_text?.trim();
    if (!query) throw new Error("input_as_text is required");
    if (!user_id) throw new Error("user_id is required");

    const effectiveSearchId = search_id || crypto.randomUUID();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    statusChannel = supabase.channel(`search-status-${effectiveSearchId}`);

    const updateStatus = async (message: string) => {
      await statusChannel.send({
        type: "broadcast",
        event: "status_update",
        payload: { message, status: "processing" },
      }, { httpSend: true }).catch((error: unknown) => {
        console.error("Could not broadcast keyword-search status:", error);
      });
    };

    await updateStatus("Submitting keyword research to Hermes...");
    const metadata = {
      search_query: query,
      creator_name: creator_name || null,
      creator_email: creator_email || null,
    };
    const { error: trackingError } = await supabase
      .from("hermes_agent_jobs")
      .upsert({
        job_id: effectiveSearchId,
        job_type: "keyword_search",
        user_id,
        status: "submitted",
        metadata,
      }, { onConflict: "job_id" });
    if (trackingError) {
      throw new Error(`Failed to track Hermes job: ${trackingError.message}`);
    }

    await submitHermesJob({
      job_id: effectiveSearchId,
      job_type: "keyword_search",
      user_id,
      prompt: buildHermesKeywordPrompt(query),
      callback_url: `${
        Deno.env.get("SUPABASE_URL")
      }/functions/v1/hermes-callback`,
      metadata,
    });

    await updateStatus("Hermes is browsing the web for matching companies...");
    await supabase.removeChannel(statusChannel);
    statusChannel = null;

    return new Response(
      JSON.stringify({
        success: true,
        mode: "hermes",
        search_id: effectiveSearchId,
        message: "Hermes keyword research started",
      }),
      { status: 202, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Hermes keyword-search error:", error);
    if (statusChannel) {
      await statusChannel.send({
        type: "broadcast",
        event: "status_update",
        payload: {
          message: error instanceof Error ? error.message : String(error),
          status: "failed",
        },
      }, { httpSend: true }).catch(() => undefined);
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
