# Supabase Security Review

## Scope

This review covers the Phase 4 content-ingestion boundary in the configured Supabase project. It does not claim that unrelated Supabase features or the wider deployment are production-secure.

## Confirmed live

- Required Phase 4 tables exist: `course_memberships`, `learning_resources`, `content_versions`, `content_processing_jobs`, `content_chunks`, `tutor_conversations`, and `tutor_messages`.
- RLS is enabled on all seven tables.
- The tables have no policies for `anon` or `authenticated`, and those roles have no table privileges on the public content tables.
- Direct `anon` access to `learning_resources` was rejected with PostgreSQL `42501`.
- The `studyhub-private` bucket exists with `public = false`, a 100 MiB limit, and the five expected academic MIME types.
- Storage RLS is enabled and no Storage policies grant browser access. Direct public object access to a synthetic object returned HTTP 400.
- A trusted server-side Storage probe uploaded, downloaded, and deleted a tiny synthetic object successfully.
- A synthetic live content transaction created membership, resource, version, processing job, and chunk rows; verified their relationships and draft exclusion; then rolled back.
- Required live indexes, foreign keys, primary keys, and unique constraints are present.

## Security model

```text
Browser
  -> StudyHub Express API
  -> studyhub_session server session
  -> server-side course/role authorization
  -> Supabase service-role client
  -> RLS-protected tables and private Storage
```

The browser does not use Supabase Auth and no browser component directly queries Supabase. The service-role credential is read only from the server environment. RLS and revoked client privileges provide a second boundary if a browser attempts to call the Supabase Data API directly.

## Confirmed local

- `npm run type-check` passed.
- `npm test -- --run` passed: 19 test files and 173 tests.
- Focused Phase 4 tests passed: 2 files and 16 tests.
- `npm run build` passed for client and SSR bundles.
- `git diff --check` passed; only existing line-ending warnings were reported.
- Browser bundle scan found no service-role credential, storage credential, database password, private storage key, SQLite dependency, or server-only filesystem module.
- Express role, course-membership, resource-visibility, processing-ownership, and Tutor ownership tests remain green.

## Source of truth

- `supabase/migrations/004_phase4_server_only_security.sql` enables RLS and revokes client-role privileges for Phase 4 tables and Storage.
- `supabase/migrations/005_phase4_revoke_public_storage_access.sql` removes inherited `PUBLIC` privileges from the Storage catalog.

Both migrations are additive. No existing rows, tables, columns, or indexes were dropped.

## Remaining risks outside this gate

- Supabase Storage catalog roles report managed inherited grants even after explicit revocation; effective direct object access remains denied by RLS and the private bucket configuration, but future Supabase platform changes should be rechecked.
- Malware scanning, audit logging, retention automation, quotas, and operational alerting remain deferred Phase 4 follow-up controls.
- Supabase service-role secret rotation and deployment-secret installation are operational tasks outside this repository change.
- Search, embeddings, pgvector, retrieval, RAG, and Tutor grounding are intentionally not implemented.

## Status

**Phase 4 security gate: PASS.**

Phase 5 is not started.