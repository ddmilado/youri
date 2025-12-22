CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text DEFAULT 'Untitled Audit',
  url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  report jsonb,
  screenshot_url text,
  status_message text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  score integer
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own jobs" ON jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow public read access to public jobs"
  ON jobs FOR SELECT
  USING (is_public = true);

-- Enable real-time for this table
-- Run this in your Supabase SQL Editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
-- ALTER TABLE jobs REPLICA IDENTITY FULL;
