-- REVERT/FIX: Use 1536 dimensions (Compatible with all PGVector versions)
-- We will use the "Smarter" text-embedding-3-large model, but cut to 1536 dims via API.

-- 1. Drop the index
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. Clear old data (required because dimensions are changing)
TRUNCATE TABLE document_chunks;

-- 3. Resize column BACK to 1536 (Standard size)
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE vector(1536);

-- 4. Create HNSW index (Better performance than ivfflat)
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 5. Update Search Function for 1536 dims
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_job_id uuid
)
returns table (
  id bigint,
  content text,
  url text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.url,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  and document_chunks.job_id = filter_job_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
