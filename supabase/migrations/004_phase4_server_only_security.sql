-- Phase 4 server-only security boundary.
-- StudyHub authenticates in Express, not through Supabase Auth. Keep the
-- exposed tables and private storage inaccessible to Data API client roles.

ALTER TABLE public.course_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.course_memberships,
  public.learning_resources,
  public.content_versions,
  public.content_processing_jobs,
  public.content_chunks,
  public.tutor_conversations,
  public.tutor_messages
FROM anon, authenticated;

-- Storage access is server-only. The bucket remains private and has no client
-- policies, so the service-role backend is the only intended access path.
REVOKE ALL ON TABLE storage.buckets, storage.objects FROM anon, authenticated;