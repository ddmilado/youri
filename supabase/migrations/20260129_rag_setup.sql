-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your document chunks
create table if not exists document_chunks (
  id bigserial primary key,
  job_id uuid not null,         -- To group chunks by the crawl job
  url text not null,            -- The source URL (critical for citation)
  content text not null,        -- The actual text chunk
  metadata jsonb,               -- Extra info like title, pageType
  embedding vector(1536)        -- OpenAI embedding (1536 dimensions)
);

-- Index for faster similarity search (optional, good for large datasets)
create index on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to search for similar documents
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
