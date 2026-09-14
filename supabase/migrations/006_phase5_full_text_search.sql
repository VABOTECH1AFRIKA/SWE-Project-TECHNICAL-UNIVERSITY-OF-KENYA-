-- Phase 5 PostgreSQL full-text search foundation.
-- Search remains server-only; no browser roles receive execute or table access.

ALTER TABLE public.content_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(heading_path, '') || ' ' || coalesce(text, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_content_chunks_search_vector
  ON public.content_chunks USING GIN (search_vector);

CREATE OR REPLACE FUNCTION public.search_published_content(
  p_version_ids text[],
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  chunk_id text,
  resource_id text,
  version_id text,
  version_number integer,
  title text,
  course_id text,
  course_code text,
  course_title text,
  chunk_text text,
  page_number integer,
  heading_path text,
  metadata jsonb,
  published_at timestamptz,
  relevance_score real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    chunk.id,
    resource.id,
    version.id,
    version.version_number,
    resource.title,
    course.id,
    course.code,
    course.title,
    chunk.text,
    chunk.page_number,
    chunk.heading_path,
    chunk.metadata,
    coalesce(version.published_at, resource.published_at),
    ts_rank(chunk.search_vector, websearch_to_tsquery('english', p_query))
  FROM public.content_chunks AS chunk
  JOIN public.content_versions AS version ON version.id = chunk.version_id
  JOIN public.content_processing_jobs AS job
    ON job.version_id = version.id
   AND job.status = 'completed'
  JOIN public.learning_resources AS resource
    ON resource.id = version.resource_id
   AND resource.status = 'published'
   AND resource.visibility = 'course'
   AND resource.current_version_id = version.id
  JOIN public.courses AS course ON course.id = resource.course_id
  WHERE chunk.version_id = ANY (p_version_ids)
    AND version.extraction_status = 'completed'
    AND version.superseded_at IS NULL
    AND chunk.search_vector @@ websearch_to_tsquery('english', p_query)
  ORDER BY ts_rank(chunk.search_vector, websearch_to_tsquery('english', p_query)) DESC,
    version.published_at DESC NULLS LAST,
    chunk.ordinal ASC,
    chunk.id ASC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_published_content(text[], text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_published_content(text[], text, integer) TO service_role;