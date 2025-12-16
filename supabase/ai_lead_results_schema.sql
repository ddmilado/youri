CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing AI-generated lead analysis results
CREATE TABLE IF NOT EXISTS ai_lead_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Company Information
  company text NOT NULL,
  website text NOT NULL,
  industry text,
  hq_location text,
  founded integer,
  employees text,
  markets text,
  revenue_2023_eur text,
  linkedin text,
  twitter text,
  
  -- Contacts (JSONB array of contact objects)
  contacts jsonb DEFAULT '[]'::jsonb,
  
  -- Lead Quality
  lead_quality_label text,
  lead_quality_score numeric,
  
  -- Localization Evidence (JSONB object)
  localization_evidence jsonb,
  
  -- Additional Notes
  notes text,
  
  -- Metadata
  input_query text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE ai_lead_results ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own lead results
CREATE POLICY "Users can view their own lead results" 
  ON ai_lead_results FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lead results" 
  ON ai_lead_results FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lead results" 
  ON ai_lead_results FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead results" 
  ON ai_lead_results FOR DELETE 
  USING (auth.uid() = user_id);
