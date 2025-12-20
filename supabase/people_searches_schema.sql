-- Table for storing people search results
CREATE TABLE IF NOT EXISTS people_searches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Search metadata
  query text NOT NULL,
  
  -- Exa.ai results stored as JSONB
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE people_searches ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own people searches" 
  ON people_searches FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own people searches" 
  ON people_searches FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own people searches" 
  ON people_searches FOR DELETE 
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_people_searches_user_created ON people_searches(user_id, created_at DESC);
CREATE INDEX idx_people_searches_query ON people_searches(query);
