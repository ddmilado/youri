CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS lead_analysis_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  url text NOT NULL,
  title text,
  target_country text,
  market_analysis jsonb,
  content_audit jsonb,
  html_report text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE lead_analysis_results ENABLE ROW LEVEL SECURITY;

-- Allow public access for now as no user_id is specified in requirements
CREATE POLICY "Enable read access for all users" ON lead_analysis_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON lead_analysis_results FOR INSERT WITH CHECK (true);
