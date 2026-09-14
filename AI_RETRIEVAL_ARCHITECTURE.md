# StudyHub Retrieval Architecture

## Contract

`searchKnowledge` accepts a server-derived user ID and role, a bounded query, optional course/topic/resource filters, and a bounded result count. It returns `results`, the normalized query, and deterministic `hasSufficientEvidence` state. Browser-supplied identity fields are ignored by the API.

Each result contains:

- chunk, resource, and version IDs
- resource title and course identity
- normalized chunk text
- version number and publication timestamp
- page number, slide metadata, and heading path when present
- relevance score and a stable chunk-level citation reference

## Authorization-first flow

1. Express authenticates the StudyHub session.
2. The retrieval service derives authorized course IDs from active memberships. Admins receive all course IDs; lecturers require lecturer/admin membership; students require active membership.
3. Resources are limited to `published`, `course` visibility, and a current version.
4. Versions are limited to the resource's current version, `extraction_status = completed`, and `superseded_at IS NULL`.
5. Only those version IDs are passed to the provider search.
6. Provider search joins authoritative resource/version state again before returning chunks.

Draft, archived, failed, superseded, private, and unauthorized content cannot become retrieval results through the normal path.

## PostgreSQL FTS

Supabase adds a generated English `tsvector` from `heading_path` and `text`, backed by `idx_content_chunks_search_vector` using GIN. The server-only `search_published_content` function uses `websearch_to_tsquery`, `ts_rank`, authoritative joins, deterministic tie-breakers, and a bounded limit. Client roles cannot execute the function.

Live verification exercised the built Express server with a disposable active course membership and published synthetic resource. The request authenticated through the StudyHub session, ignored browser identity fields, returned the authorized chunk, and cleaned all synthetic records afterward.

## SQLite fallback

SQLite keeps the existing schema and uses parameterized token matching over the already-authorized version IDs. Its deterministic fallback score is token coverage, with phrase and heading boosts. This preserves the behavior contract without pretending SQLite has PostgreSQL's planner or FTS implementation.

## Tutor boundary

`RetrievalTutorContextProvider` converts retrieval results into bounded course context and `TutorCitation` values. The fake model provider remains the only response generator. Phase 5 produces retrieved knowledge; it does not generate answers.

## Deferred

Embeddings, pgvector, semantic search, hybrid retrieval, LLM reranking, model providers, Tutor response generation, ML, and recommendations remain Phase 6 or later work.