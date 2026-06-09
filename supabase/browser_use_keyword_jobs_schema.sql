CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS browser_use_keyword_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  search_id text,
  search_query text NOT NULL,
  creator_name text,
  creator_email text,
  status text DEFAULT 'created',
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE browser_use_keyword_jobs
  ALTER COLUMN session_id TYPE text USING session_id::text;

ALTER TABLE browser_use_keyword_jobs
  ALTER COLUMN search_id TYPE text USING search_id::text;

ALTER TABLE browser_use_keyword_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own browser use keyword jobs"
  ON browser_use_keyword_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_browser_use_keyword_jobs_session_id
  ON browser_use_keyword_jobs(session_id);

CREATE INDEX IF NOT EXISTS idx_browser_use_keyword_jobs_user_created
  ON browser_use_keyword_jobs(user_id, created_at DESC);
