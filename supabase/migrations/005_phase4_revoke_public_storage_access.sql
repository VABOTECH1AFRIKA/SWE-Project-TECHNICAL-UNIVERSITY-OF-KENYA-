-- Remove inherited PUBLIC privileges from the server-only Storage catalog.
-- Explicit client-role revokes remain in migration 004 for clarity.

REVOKE ALL ON TABLE storage.buckets, storage.objects
FROM PUBLIC, anon, authenticated;