const job = JSON.parse(process.env.YOURI_HERMES_JOB || '{}')

console.log(JSON.stringify({
  status: 'success',
  results: [
    {
      company_name: 'Wrapper Test Company',
      website: 'https://example.com',
      company_description: `Wrapper test result for: ${job.search_query || 'unknown query'}.`,
      category: 'test',
      country: 'Netherlands',
      shipping_evidence: 'Test evidence.',
      revenue_evidence: 'Test evidence.',
      revenue_estimate: 'EUR 500k+ indicated',
      evidence_urls: ['https://example.com'],
    },
  ],
}))
