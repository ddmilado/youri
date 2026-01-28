-- Migration: Add crawl status tracking columns to jobs table
-- Run this in Supabase SQL Editor

-- Add crawl_status column to track crawl phase separately
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crawl_status text DEFAULT 'pending' 
  CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed'));

-- Add raw_data column to store crawled content (for reuse)
-- Note: This might already exist in your setup
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS raw_data jsonb;

-- Add crawled_at timestamp to track when data was crawled (for cache expiry)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crawled_at timestamp with time zone;

-- Add creator columns if not already present
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS creator_name text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS creator_email text;

-- Index for faster lookups on crawl_status
CREATE INDEX IF NOT EXISTS idx_jobs_crawl_status ON jobs(crawl_status);

-- Comment describing the two-phase architecture
COMMENT ON COLUMN jobs.crawl_status IS 'Phase 1 status: pending -> crawling -> completed';
COMMENT ON COLUMN jobs.raw_data IS 'Cached crawl data for reuse (expires after 24h)';
COMMENT ON COLUMN jobs.crawled_at IS 'When the crawl data was last fetched';
