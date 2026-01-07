-- Add creator info columns to jobs table
-- This allows us to display "John Doe" instead of just an ID, without complex joins to auth.users
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS creator_name text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS creator_email text;

-- Optional: Backfill existing jobs with email if possible, or just leave null
-- (We can't easily backfill names from here without access to auth schema, so we skip backfill)
