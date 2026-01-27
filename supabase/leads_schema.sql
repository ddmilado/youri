-- Create the leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES jobs(id), -- Optional link to original audit
  url text NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'lost', 'won')),
  created_by uuid REFERENCES auth.users NOT NULL,
  creator_name text,
  creator_email text,
  created_at timestamp with time zone DEFAULT now(),
  company_name text, -- Optional manual override or extracted name
  company_data jsonb DEFAULT '{}'::jsonb -- Enriched data (industry, revenue, etc.)
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Creator can manage their own leads
CREATE POLICY "Creator can manage leads" ON leads
  FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Policy: Teammates can view leads (Read Only for team)
CREATE POLICY "Teammates can view leads" ON leads
  FOR SELECT
  USING (
    -- 1. I am the leader of the lead creator
    auth.uid() IN (SELECT inviter_id FROM team_members WHERE member_id = leads.created_by AND status = 'active')
    OR
    -- 2. The lead creator is my leader
    auth.uid() IN (SELECT member_id FROM team_members WHERE inviter_id = leads.created_by AND status = 'active')
    OR
    -- 3. We are peers (share the same leader)
    EXISTS (
      SELECT 1 FROM team_members t1
      JOIN team_members t2 ON t1.inviter_id = t2.inviter_id
      WHERE t1.member_id = auth.uid() 
      AND t2.member_id = leads.created_by
      AND t1.status = 'active' 
      AND t2.status = 'active'
    )
  );
