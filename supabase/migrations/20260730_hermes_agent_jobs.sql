CREATE TABLE IF NOT EXISTS hermes_agent_jobs (
  job_id text PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('keyword_search', 'url_audit')),
  user_id uuid REFERENCES auth.users NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'processing', 'completed', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE hermes_agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Hermes jobs"
  ON hermes_agent_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hermes_agent_jobs_user_created
  ON hermes_agent_jobs(user_id, created_at DESC);
