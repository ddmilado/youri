-- Create the team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id uuid REFERENCES auth.users NOT NULL,
  member_email text NOT NULL,
  member_id uuid REFERENCES auth.users, -- Can be null initially until they sign up/match
  status text DEFAULT 'active' CHECK (status IN ('pending', 'active')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(inviter_id, member_email)
);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Inviters can manage their team
CREATE POLICY "Inviters can manage team" ON team_members
  FOR ALL
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

-- Policy: Members can view their own membership rows (to know who their boss is)
CREATE POLICY "Members can view membership" ON team_members
  FOR SELECT
  USING (auth.email() = member_email OR auth.uid() = member_id);

-- UPDATING JOBS POLICIES
-- First, drop existing policy to avoid conflicts if needed (or just add new ones)
-- We'll assume we are adding to the existing schema.

-- 1. VIEW POLICY (SELECT)
-- Allow owners to see their own jobs (existing policy usually covers this)
-- PLUS: Allow Inviters to see Member's jobs ("You can see their audits")
-- 3. BROAD TEAM VIEW POLICY
-- Allow view if:
-- 1. I am the inviter (Leader viewing Member)
-- 2. I am the member (Member viewing Leader)
-- 3. We share the same inviter (Member viewing Peer)

CREATE POLICY "Teammates can view each others jobs" ON jobs
  FOR SELECT
  USING (
    -- 1. I am the leader of the job owner
    auth.uid() IN (SELECT inviter_id FROM team_members WHERE member_id = jobs.user_id AND status = 'active')
    OR
    -- 2. The job owner is my leader
    auth.uid() IN (SELECT member_id FROM team_members WHERE inviter_id = jobs.user_id AND status = 'active')
    OR
    -- 3. We are peers (share the same leader)
    EXISTS (
      SELECT 1 FROM team_members t1
      JOIN team_members t2 ON t1.inviter_id = t2.inviter_id
      WHERE t1.member_id = auth.uid() 
      AND t2.member_id = jobs.user_id
      AND t1.status = 'active' 
      AND t2.status = 'active'
    )
  );

-- OPTIONAL: Allow Members to see Leader's jobs? 
-- User didn't strictly ask, but often desirable. Uncomment if needed.
-- OR auth.uid() IN (SELECT member_id FROM team_members WHERE inviter_id = jobs.user_id)

-- 2. DELETE POLICY
-- STRICTLY OWNER ONLY (User Requirement: "You should not have access to delete their audits")
-- This means we DO NOT add any team-based DELETE policy.
-- The existing policy "Users can manage own jobs" usually allows ALL (Select, Insert, Update, Delete) for owner.
-- We must strictly ensure that NO OTHER policy grants DELETE.
-- Since Supabase policies are permissive (OR logic), as long as we don't add a "Team Delete" policy, we are safe.

-- 3. UPDATE POLICY (Optional)
-- Do we want to allow editing? User didn't say. Let's assume View Only for now.

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_team_members_inviter ON team_members(inviter_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(member_email);
