import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

type HermesResult = Record<string, unknown>;

interface HermesCallbackPayload {
  job_id: string;
  job_type: "keyword_search" | "url_audit";
  user_id: string;
  status?: "success" | "partial" | "failure";
  error?: string | null;
  results?: HermesResult[];
  report?: Record<string, unknown> | null;
  run_id?: string | null;
  metadata?: Record<string, unknown>;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function normalizeUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function rootDomain(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeKeywordResults(results: HermesResult[]) {
  const seen = new Set<string>();
  return results.flatMap((result) => {
    const website = normalizeUrl(result.website || result.url);
    const companyName = String(result.company_name || result.companyName || "")
      .trim();
    const domain = rootDomain(website);
    if (!companyName || !domain || seen.has(domain)) return [];
    seen.add(domain);

    const details = [
      result.company_description || result.companyDescription,
      result.category ? `Category: ${result.category}.` : "",
      result.shipping_evidence
        ? `Shipping evidence: ${result.shipping_evidence}.`
        : "",
      result.revenue_evidence
        ? `Revenue signal: ${result.revenue_evidence}.`
        : "",
      result.revenue_estimate
        ? `Revenue estimate: ${result.revenue_estimate}.`
        : "",
    ].filter(Boolean).join(" ").slice(0, 2000);

    return [{
      company_name: companyName,
      website,
      company_description: details,
    }];
  });
}

function normalizeAuditReport(
  candidate: Record<string, unknown>,
  targetUrl: string,
  runId?: string | null,
) {
  if (!Array.isArray(candidate.sections)) {
    throw new Error("Hermes audit report must contain sections");
  }

  const sections = candidate.sections.map((sectionValue) => {
    const section = (sectionValue || {}) as Record<string, unknown>;
    const findings = Array.isArray(section.findings) ? section.findings : [];
    return {
      ...section,
      title: String(section.title || "Audit Findings"),
      findings: findings.map((findingValue) => {
        const finding = (findingValue || {}) as Record<string, unknown>;
        const rawSeverity = String(finding.severity || "medium").toLowerCase();
        return {
          ...finding,
          problem: String(finding.problem || "Issue identified"),
          explanation: String(
            finding.explanation || finding.impact ||
              "Hermes identified a website risk.",
          ),
          recommendation: String(
            finding.recommendation || "Review and correct this issue.",
          ),
          severity: ["high", "medium", "low"].includes(rawSeverity)
            ? rawSeverity
            : "medium",
          sourceUrl: String(finding.sourceUrl || targetUrl),
          verificationNote: String(
            finding.verificationNote ||
              "Verified by Hermes using the live website.",
          ),
        };
      }),
    };
  });

  const suppliedScore = Number(candidate.score);
  const score = Number.isFinite(suppliedScore)
    ? Math.max(0, Math.min(100, Math.round(suppliedScore)))
    : 0;
  const companyInfo = (candidate.companyInfo || {}) as Record<string, unknown>;

  return {
    ...candidate,
    overview: String(candidate.overview || `Website audit for ${targetUrl}.`),
    companyInfo: {
      ...companyInfo,
      name: String(companyInfo.name || rootDomain(targetUrl) || targetUrl),
      contacts: Array.isArray(companyInfo.contacts) ? companyInfo.contacts : [],
    },
    sections,
    actionList: Array.isArray(candidate.actionList) ? candidate.actionList : [],
    evidenceScreenshots: Array.isArray(candidate.evidenceScreenshots)
      ? candidate.evidenceScreenshots
      : [],
    conclusion: String(
      candidate.conclusion || "The Hermes website audit is complete.",
    ),
    score,
    agentProvider: "hermes",
    agentRunId: runId || undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: responseHeaders,
      },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    const expectedToken = Deno.env.get("HERMES_CALLBACK_TOKEN");
    if (!expectedToken) {
      throw new Error("HERMES_CALLBACK_TOKEN is not configured");
    }
    if (bearerToken(req) !== expectedToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: responseHeaders,
        },
      );
    }

    const payload = await req.json() as HermesCallbackPayload;
    if (!payload.job_id || !payload.job_type || !payload.user_id) {
      throw new Error("job_id, job_type, and user_id are required");
    }

    const { data: trackedJob, error: lookupError } = await supabase
      .from("hermes_agent_jobs")
      .select("*")
      .eq("job_id", payload.job_id)
      .single();
    if (lookupError || !trackedJob) throw new Error("Unknown Hermes job");
    if (
      trackedJob.user_id !== payload.user_id ||
      trackedJob.job_type !== payload.job_type
    ) {
      throw new Error("Hermes callback does not match the submitted job");
    }
    if (trackedJob.status === "completed") {
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: responseHeaders,
      });
    }

    const failed = payload.status === "failure";
    let resultCount = 0;

    if (!failed && payload.job_type === "keyword_search") {
      const results = normalizeKeywordResults(payload.results || []);
      resultCount = results.length;
      const metadata = trackedJob.metadata || {};
      if (results.length > 0) {
        const rows = results.map((result) => ({
          user_id: payload.user_id,
          search_query: String(
            metadata.search_query || "Hermes keyword search",
          ),
          company_name: result.company_name,
          website: result.website,
          company_description: result.company_description,
          analyzed: false,
          analysis_id: null,
          creator_name: metadata.creator_name || null,
          creator_email: metadata.creator_email || null,
        }));
        const { error } = await supabase.from("keyword_search_results").insert(
          rows,
        );
        if (error) {
          throw new Error(`Could not save keyword results: ${error.message}`);
        }
      }
    }

    if (!failed && payload.job_type === "url_audit") {
      if (!payload.report) {
        throw new Error("Hermes URL audit callback is missing report");
      }
      const metadata = trackedJob.metadata || {};
      const targetUrl = String(metadata.target_url || "");
      const report = normalizeAuditReport(
        payload.report,
        targetUrl,
        payload.run_id,
      );
      const evidence = Array.isArray(report.evidenceScreenshots)
        ? report.evidenceScreenshots
        : [];
      const screenshotUrl = evidence.find((item: unknown) => {
        return item && typeof item === "object" &&
          typeof (item as Record<string, unknown>).url === "string";
      }) as Record<string, unknown> | undefined;

      const { error } = await supabase.from("jobs").update({
        status: "completed",
        report,
        status_message: "Hermes audit completed!",
        completed_at: new Date().toISOString(),
        score: report.score,
        screenshot_url: screenshotUrl?.url || null,
        raw_data: {
          source: "hermes",
          run_id: payload.run_id || null,
          target_url: targetUrl,
          completed_at: new Date().toISOString(),
        },
      }).eq("id", payload.job_id).eq("user_id", payload.user_id);
      if (error) {
        throw new Error(`Could not save audit report: ${error.message}`);
      }
    }

    if (failed && payload.job_type === "url_audit") {
      await supabase.from("jobs").update({
        status: "failed",
        status_message: `Hermes audit failed: ${
          String(payload.error || "Unknown error").slice(0, 120)
        }`,
      }).eq("id", payload.job_id).eq("user_id", payload.user_id);
    }

    await supabase.from("hermes_agent_jobs").update({
      status: failed ? "failed" : "completed",
      run_id: payload.run_id || null,
      error: payload.error || null,
      completed_at: new Date().toISOString(),
    }).eq("job_id", payload.job_id);

    const channelPrefix = payload.job_type === "url_audit"
      ? "job-status"
      : "search-status";
    const channel = supabase.channel(`${channelPrefix}-${payload.job_id}`);
    await channel.send({
      type: "broadcast",
      event: "status_update",
      payload: {
        id: payload.job_id,
        status: failed ? "failed" : "completed",
        message: failed
          ? payload.error || "Hermes job failed"
          : payload.job_type === "url_audit"
          ? "Hermes audit completed!"
          : "Search complete!",
        count: resultCount,
      },
    }, { httpSend: true });
    await supabase.removeChannel(channel);

    return new Response(
      JSON.stringify({
        success: !failed,
        status: failed ? "failed" : "completed",
        count: resultCount,
      }),
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error("Hermes callback error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: responseHeaders },
    );
  }
});
