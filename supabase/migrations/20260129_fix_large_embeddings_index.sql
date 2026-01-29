-- FIX for "column cannot have more than 2000 dimensions"
-- We must DROP the old index before resizing, because 'ivfflat' only supports up to 2000 dims.

-- 1. Drop the existing index (if any)
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. Clear old data
TRUNCATE TABLE document_chunks;

-- 3. Resize the column
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE vector(3072);

-- 4. Create a NEW index compatible with large vectors (HNSW supports up to 4096 dimensions)
-- Note: 'hnsw' is better for performance anyway!
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 5. Update the search function (Same as before)
create or replace function match_document_chunks (
  query_embedding vector(3072),
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
