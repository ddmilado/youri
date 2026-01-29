-- Resize the vector column to support "text-embedding-3-large" (3072 dimensions)
-- WARNING: This will DELETE existing vectors because you cannot resize a vector column with data in it without losing dimensions.
-- Since this is a cache, deleting is fine. Re-crawling will re-populate it.

TRUNCATE TABLE document_chunks;

ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE vector(3072);

-- Update the search function to accept 3072 dimensions
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
    1 - (document_chunks.embedding <=> query_embedding) as similarity -- 1 - distance = similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  and document_chunks.job_id = filter_job_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
