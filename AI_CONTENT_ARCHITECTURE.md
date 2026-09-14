# StudyHub AI Content Architecture

## Current state

### Confirmed from source

- `notes` stores title, course, type, date, size, and pages only.
- `assignments`, `quizzes`, `quiz_questions`, `flashcards`, and `videos` are flat course-linked records.
- `src/pages/lecturer.tsx` provides metadata creation, file selection, upload, processing state, and retry controls.
- `src/pages/admin.tsx` provides an upload control in the courses tab alongside user/status administration.
- `src/server/api/studyhub-sqlite.ts` exposes lecturer/admin-only text ingestion at `/learning-resources/:id/ingest` and version listing at `/learning-resources/:id/versions`.
- SQLite and Supabase repositories create content versions, processing-job metadata, and deterministic text chunk content/boundaries; record IDs are generated per version.
- Multipart ingestion accepts TXT, Markdown, PDF, DOCX, and PPTX with server-side validation.
- Private local storage is used for SQLite/tests; Supabase Storage is selected for the Supabase provider.
- Processing is stateful: queued -> processing -> completed or failed, with protected status and retry endpoints.
- Live Supabase security is confirmed: RLS is enabled on the Phase 4 content and Tutor tables, browser roles have no privileges on those public tables, and no client policies exist.
- The `studyhub-private` bucket is private; Storage access is server-only through the Supabase service-role client, and direct anonymous object access is denied.

### Implemented in Phase 4

```text
Seed script / SQL migrations
  -> flat course-linked records
  -> provider repository
  -> student API pages

Lecturer/Admin authenticated multipart request
  -> course authorization and file validation
  -> private storage and immutable version/job intent
  -> extraction, normalization, and deterministic chunks
  -> completed or failed processing state

AI Tutor
  -> mock messages only
```

## Target content model

Use the smallest coherent model first. Do not create every possible table at once.

### MVP entities

1. `learning_resources`: logical resource with course, title, type, author/uploader, visibility, status, and current version.
2. `content_versions`: immutable uploaded/text version with storage pointer, checksum, extraction status, publication timestamps, and provenance.
3. `content_chunks`: normalized text chunks with ordinal, page/section location, and version relationship.
4. `content_processing_jobs`: queued extraction/chunk/index state with retry/error fields.
5. `course_memberships`: server-enforced user/course access.

### Later entities

- `learning_modules` and `learning_topics` for hierarchy.
- `content_embeddings` if embeddings are kept separate from chunks.
- `content_permissions` for exceptions beyond course membership.
- `tutor_conversations`, `tutor_messages`, `student_topic_mastery`, and `learning_events` belong to adjacent capabilities but are required for the full target system.

## Recommended fields

### learning_resources

- `id`, `course_id` or stable course code
- `title`, `resource_type`
- `owner_user_id`, `uploader_user_id`
- `visibility` (`course`, `private`, `institution`)
- `status` (`draft`, `processing`, `published`, `archived`, `failed`)
- `current_version_id`
- optional module/topic IDs
- `created_at`, `updated_at`, `published_at`

### content_versions

- `id`, `resource_id`, `version_number`
- `storage_key`, `mime_type`, `byte_size`, `sha256`
- `extraction_status`, `extracted_text_key`
- `created_by`, `created_at`, `superseded_at`

### content_chunks

- `id`, `version_id`, `ordinal`
- `text`, `token_count`
- `page_number`, `heading_path`, `char_start`, `char_end`
- `metadata JSONB`
- search index and optional embedding reference

### content_processing_jobs

- `id`, `version_id`, `job_type`, `status`
- `attempt_count`, `last_error`, `started_at`, `finished_at`, `next_attempt_at`

## Ingestion workflow

```text
Implemented Phase 4B path:
  -> authenticated lecturer/admin multipart request
  -> validate role, authorized course/resource, size, MIME type, extension, and filename
  -> create immutable version/job intent and server-generated private storage key
  -> extract TXT, Markdown, PDF, DOCX, or PPTX content
  -> chunk with text, page/slide, section, and offset provenance
  -> complete or fail processing; expose status and protected retry

Deferred:
  -> indexing, embeddings, retrieval, and Tutor grounding
```

## File strategy

| Type | First implementation | Main risk |
|---|---|---|
| TXT/Markdown | Server-side text parse | Oversized/untrusted content |
| PDF | Isolated parser with page metadata | Scanned PDFs and parser exploits |
| DOCX | Isolated document parser | Embedded objects and formatting loss |
| PPTX | Slide text extraction | Speaker notes/media omissions |
| Images | Defer OCR until need is proven | Cost, privacy, extraction errors |
| Authored text | Direct versioned text resource | Missing provenance if bypassing review |

The multipart endpoint enforces a 25 MiB limit, supported academic MIME types, safe filenames, and extension consistency. Temporary files are cleaned up; storage cleanup compensates for failures before a database reference is persisted. Malware scanning, audit logging, and retention automation remain deferred.

## Publication and access rules

- Student retrieval must require an active course membership or an explicit public visibility rule.
- Draft, failed, archived, or superseded versions must not enter default Tutor retrieval.
- Lecturer may manage resources for courses they own/teach; admin may manage globally.
- Role values from the browser are never trusted.
- RLS/server authorization must enforce access independently of retrieval filters.
- Citations must point to a published version/chunk, never only a mutable title.

The live database uses a deny-by-default RLS barrier rather than Supabase Auth policies because application authentication is handled by the StudyHub Express session layer. The service-role client remains server-only and is never sent to the browser.

## Retrieval design

Phase 5 implements the first keyword retrieval path:

```text
authenticated StudyHub session
  -> authorized course IDs
  -> published/current/completed version IDs
  -> PostgreSQL full-text search or SQLite token search
  -> deterministic ranking
  -> chunk provenance and citation reference
```

Supabase stores a generated English `tsvector` on `content_chunks` with a GIN index. The server-only `search_published_content` function applies authoritative resource, version, publication, visibility, and processing filters before returning `ts_rank` results. SQLite uses parameterized token matching over the same authorized version set and applies a deterministic phrase, token-coverage, and heading fallback score.

The retrieval contract is provider-neutral and returns chunk, resource, version, course, page/slide, heading, publication, relevance, and stable citation fields. Empty or weak matches return results without fabricating an answer; `hasSufficientEvidence` is deterministic.

### Deferred hybrid retrieval

Evaluate Supabase Postgres plus pgvector after content volume and evaluation data justify it:

- keyword candidates for exact terms
- vector candidates for semantic matches
- merge/deduplicate
- optional rerank
- enforce authorization before returning context

The repository already targets Supabase Postgres, so pgvector is a plausible future fit, but it is not present today and must not be enabled without separate migration, index, cost, and evaluation work.

## Tutor context contract

The retrieval service should return source records such as:

```text
source_id, resource_id, version_id, chunk_id,
title, course, page_number, heading_path, text, published_at
```

The orchestrator should pass only authorized, bounded context to the model and return:

```text
answer, citations[], confidence/grounding status, suggested follow-up
```

When no sufficient source is found, the Tutor should say so and offer a general explanation explicitly labeled as general knowledge.

## Migration approach

1. Add additive schema migrations only.
2. Backfill existing notes as metadata resources only until actual file/text content exists.
3. Do not pretend existing `size/pages` fields are extractable content.
4. Preserve existing notes/quizzes/flashcards APIs.
5. Introduce new content routes behind role and publication checks.
6. Index only published, successfully processed versions.
7. Roll back by disabling new retrieval/resource routes, not by deleting legacy data.

## Phase 4 acceptance evidence

- Required live tables and indexes exist.
- RLS is enabled on `course_memberships`, `learning_resources`, `content_versions`, `content_processing_jobs`, `content_chunks`, `tutor_conversations`, and `tutor_messages`.
- No `anon` or `authenticated` policies or privileges expose those tables.
- `studyhub-private` is private and direct anonymous object access was denied in a live test.
- Synthetic live membership/resource/version/job/chunk records were created, relationship-checked, filtered from published results, and rolled back.
- Local Express authorization, SQLite provider tests, type-check, full tests, focused tests, production build, diff check, and browser-bundle scans pass.

## Deferred beyond Phase 4

- Lecturer can upload a permitted file to a permitted course.
- Admin can review/publish/archive it.
- Student can retrieve only published authorized material.
- Processing status and failure are visible to staff.
- Tutor answers cite exact source versions/chunks.
- Deleting or superseding a version removes it from retrieval without deleting audit history.
- No client receives service-role credentials or private storage keys.
