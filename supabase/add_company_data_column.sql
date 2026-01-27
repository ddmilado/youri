-- Add company_data column to existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_data jsonb DEFAULT '{}'::jsonb;
