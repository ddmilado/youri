CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing keyword search results
CREATE TABLE IF NOT EXISTS keyword_search_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Search metadata
  search_query text NOT NULL,
  
  -- Company information from search
  company_name text NOT NULL,
  website text NOT NULL,
  company_description text,
  
  -- Link to deep analysis if performed
  analyzed boolean DEFAULT false,
  analysis_id uuid REFERENCES ai_lead_results(id),
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE keyword_search_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own search results" 
  ON keyword_search_results FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search results" 
  ON keyword_search_results FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search results" 
  ON keyword_search_results FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search results" 
  ON keyword_search_results FOR DELETE 
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_keyword_search_user_created ON keyword_search_results(user_id, created_at DESC);
CREATE INDEX idx_keyword_search_query ON keyword_search_results(search_query);
