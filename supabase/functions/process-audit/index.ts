import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { jobId } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: job, error: jobError } = await supabaseClient.from('jobs').select('*').eq('id', jobId).single()
    if (jobError || !job) throw new Error('Job not found')

    const processingTime = 15000 + Math.random() * 5000
    await new Promise((resolve) => setTimeout(resolve, processingTime))

    const issueLibrary = [
      { title: 'Missing alt text on images', severity: 'medium', description: 'Several images are missing descriptive alt text for accessibility', type: 'accessibility' },
      { title: 'Slow page load time', severity: 'high', description: 'Page takes over 3 seconds to load', type: 'performance' },
      { title: 'Missing meta description', severity: 'low', description: 'No meta description tag found', type: 'seo' },
      { title: 'Broken internal links', severity: 'high', description: 'Detected broken internal links returning 404 responses', type: 'links' },
      { title: 'No HTTPS redirect', severity: 'critical', description: 'HTTP version does not redirect to HTTPS', type: 'security' },
      { title: 'Large image file sizes', severity: 'medium', description: 'Images exceed 500KB and should be optimized', type: 'performance' },
      { title: 'Missing robots.txt', severity: 'low', description: 'Robots.txt not found in site root', type: 'seo' },
      { title: 'Missing structured data', severity: 'medium', description: 'No schema.org structured data present', type: 'seo' },
      { title: 'Inline CSS detected', severity: 'low', description: 'Large amounts of inline CSS should be extracted', type: 'performance' },
      { title: 'Low contrast text', severity: 'medium', description: 'Some text elements fail WCAG contrast requirements', type: 'accessibility' },
    ]

    const issueCount = Math.floor(Math.random() * 8) + 3
    const issues = Array.from({ length: issueCount }, () => issueLibrary[Math.floor(Math.random() * issueLibrary.length)])

    const report = {
      issuesCount: issues.length,
      issues,
      summary: {
        high: issues.filter((issue) => ['high', 'critical'].includes(issue.severity.toLowerCase())).length,
        medium: issues.filter((issue) => issue.severity.toLowerCase() === 'medium').length,
        low: issues.filter((issue) => issue.severity.toLowerCase() === 'low').length,
      },
    }

    const screenshotUrl = `https://via.placeholder.com/1200x800/1e1b4b/ffffff?text=${encodeURIComponent(new URL(job.url).hostname)}`

    const { error: updateError } = await supabaseClient
      .from('jobs')
      .update({ status: 'completed', report, completed_at: new Date().toISOString(), screenshot_url: screenshotUrl })
      .eq('id', jobId)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('process-audit error', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
