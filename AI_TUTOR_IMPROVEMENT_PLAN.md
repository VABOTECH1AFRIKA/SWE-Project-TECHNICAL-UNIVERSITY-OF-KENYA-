# StudyHub AI Tutor Improvement Plan

## Current state

The current Tutor is a client-only placeholder in `src/pages/ai-tutor.tsx`. There is no model provider, Tutor API, prompt registry, conversation storage, retrieval, content ingestion, topic mastery, or AI evaluation. Existing course/academic data is available through `src/lib/api.ts` and `src/server/data/index.ts`, but the Tutor does not consume it.

## Target architecture

```text
Student UI
  -> Express API and server auth
  -> Tutor orchestrator
      -> student/course context
      -> deterministic learning signals
      -> conversation memory
      -> authorized content retrieval
      -> LLM provider adapter
      -> citation and safety validator
  -> answer, citations, follow-up, learning event
```

```text
Lecturer/Admin
  -> content management
  -> private file/text resource
  -> processing job
  -> extracted version/chunks
  -> keyword/vector indexes
  -> published authorized knowledge
  -> Tutor retrieval
```

## Capability priorities

| Capability | Existing enabler | Missing | Priority |
|---|---|---|---|
| Course-aware tutoring | Courses API and selector | Real user/course context | P0 |
| Grounded answers | Notes/course records | Content text, retrieval, citations | P0 |
| Conversation context | Local React messages | Durable conversation/message tables | P0 |
| Safe model access | Server API boundary | Provider adapter, secrets, limits | P0 |
| Adaptive explanation | Profile/quiz data | Topic signals and policy | P1 |
| Practice generation | Quiz/question schema | Model generation, validation, attempt tracking | P1 |
| Mistake analysis | Question explanations | Attempt answers and event data | P1 |
| Study-plan generation | Study-plan repository | Deterministic constraints and Tutor action contract | P1 |
| Lecturer context | Lecturer/course labels | Content ownership/publication model | P0 |
| Personalization | Analytics snapshot | Event stream/mastery model | P1 |
| Recommendations | Videos/study plan | Ranking signals and feedback | P2 |
| Predictive ML | None | Large labeled event history and evaluation | P3 |

## Phase 0 - Baseline and contract freeze

- **Objective:** preserve current routes/provider behavior while defining the Tutor boundary.
- **Evidence:** `src/pages/ai-tutor.tsx`, `src/lib/api.ts`, `src/server/entry.ts`, `src/server/data/index.ts`.
- **Modify:** `src/lib/api.ts`, route tests, data boundary documentation.
- **Create:** `src/server/ai/` contract module and focused tests.
- **Database:** none.
- **API:** define request/response types without enabling a model yet.
- **Frontend:** replace no behavior yet; document placeholder state.
- **AI:** none.
- **Security:** require auth and course scope in the future contract.
- **Tests:** contract, unauthorized, malformed request.
- **Acceptance:** existing 145-test baseline remains green; no secret enters client.
- **Dependencies:** none.

### Implementation prompt

```text
Audit and formalize the Tutor API contract only. Inspect src/pages/ai-tutor.tsx, src/lib/api.ts, src/server/entry.ts, src/server/api/studyhub-sqlite.ts, src/server/data/index.ts, and auth/session.ts. Add typed server/client contracts and focused tests, but do not call an LLM, add schema, change existing routes, or alter the current placeholder UI. Validate type-check, focused tests, full tests, and build. Keep SQLite/Supabase provider behavior unchanged.
```

## Phase 1 - Tutor architecture cleanup

- **Objective:** introduce server orchestration seams and a provider-neutral model adapter.
- **Evidence:** no current server AI module or provider import exists.
- **Create:** `src/server/ai/tutor-orchestrator.ts`, `src/server/ai/model-provider.ts`, `src/server/ai/prompts.ts`, tests.
- **Modify:** Tutor API client/page only after server contract exists.
- **Database:** none initially; conversation persistence deferred to Phase 2.
- **API:** authenticated Tutor message endpoint with bounded input/output.
- **AI:** model adapter selected through server environment, never Vite client env.
- **Security:** rate limits, input limits, redaction, no secret logging.
- **Tests:** fake provider contract tests; no network-dependent unit tests.
- **Acceptance:** a deterministic fake response can travel through the server boundary.
- **Dependencies:** Phase 0.

### Implementation prompt

```text
Implement the smallest server-only Tutor orchestration seam using the Phase 0 contract. Create a provider interface and deterministic fake provider for tests; do not add a real vendor dependency unless the repository already has one. Keep prompts server-only, validate input, require authenticated users, and return a stable response shape. Do not add persistence, retrieval, frontend redesign, or Supabase schema changes. Run focused tests, type-check, full tests, and build.
```

## Phase 2 - Learning-content model and conversation memory

- **Objective:** add durable, authorized resources and Tutor conversations.
- **Evidence:** current notes have metadata only; no topic hierarchy or conversation tables.
- **Create:** additive Supabase/SQLite migrations as appropriate, repository methods, `learning_resources`, `content_versions`, `tutor_conversations`, `tutor_messages`.
- **Modify:** `src/server/data/index.ts`, auth/authorization, API contracts.
- **Database:** indexes by course/user/status/created time; retention policy required.
- **API:** conversation list/create/message endpoints; resource metadata endpoints.
- **Frontend:** load conversations instead of local-only state.
- **AI:** pass bounded conversation history.
- **Security:** user ownership and course membership enforced server-side.
- **Tests:** repository contract tests for both providers, authorization, retention/limits.
- **Acceptance:** refresh preserves a user-owned conversation; another user cannot read it.
- **Dependencies:** Phase 1.

### Implementation prompt

```text
Add the smallest additive conversation/resource metadata model required by the existing Tutor contract. Inspect the verified Supabase schema and SQLite repository patterns first. Implement migrations, provider methods, API authorization, and focused contract tests for ownership and course scope. Do not implement file extraction, embeddings, or broad topic hierarchy yet. Preserve current academic APIs and SQLite rollback.
```

## Phase 3 - Lecturer/admin content management

- **Objective:** replace visual upload stubs with authorized resource management.
- **Evidence:** `src/pages/lecturer.tsx` Upload/Generate Quiz buttons have no handlers; admin currently manages users/statuses.
- **Create:** resource routes, staff UI state, audit events.
- **Modify:** lecturer/admin pages, API client, provider repositories.
- **Database:** resource ownership, visibility, publication status, version metadata.
- **API:** create/edit/archive/publish endpoints; no client-trusted role.
- **Frontend:** staff forms and processing/publish status.
- **AI:** none required for CRUD.
- **Security:** lecturer course ownership; admin override; student read-only published content.
- **Tests:** role matrix, course scope, draft visibility, archive behavior.
- **Acceptance:** staff can manage metadata without exposing private resources.
- **Dependencies:** Phase 2.

### Implementation prompt

```text
Implement staff-only learning-resource metadata management based on actual lecturer/admin routes and roles. Trace server authorization before editing UI. Add draft/published/archive states, ownership checks, provider methods, and focused role tests. Do not add uploads, extraction, embeddings, or model calls in this phase. Preserve existing admin user management and API contracts.
```

## Phase 4 - Content ingestion pipeline

- **Objective:** turn approved files/text into versioned searchable content.
- **Confirmed from source:** lecturer/admin multipart ingestion creates private storage objects, immutable versions, processing jobs, and chunks through provider-aware repository paths; authorization, size, MIME, extension, and filename validation are enforced.
- **Implemented in Phase 4B:** local/Supabase private storage abstraction, TXT/Markdown/PDF/DOCX/PPTX extraction, queued/processing/completed/failed state, status/retry routes, checksum deduplication, cleanup, deterministic chunking, page/slide provenance, and lecturer/admin upload controls.
- **Deferred:** search, embeddings, pgvector, reranking, RAG, malware scanning, audit logging, and retention automation.
- **Modify:** resource management and status UI.
- **Database:** versions, jobs, chunks, checksums, extraction metadata.
- **API:** upload/status/retry/publish routes.
- **Frontend:** progress/errors/retry and review screens.
- **AI:** none required for extraction; embeddings deferred until Phase 5.
- **Security:** MIME/size validation, private storage, malware scanning, path safety, quotas.
- **Tests:** focused tests cover authorized multipart ingestion, all five supported formats, page/slide provenance, private local storage, malformed PDF failure, status, retry, Markdown normalization, MIME/filename rejection, and authorization. Live Supabase ingestion remains environment-dependent.
- **Acceptance:** Phase 4B behavior is implemented and tested; the configured Supabase project has been verified with live RLS, deny-by-default browser access, private Storage, synthetic content relationship checks, and trusted Storage upload/download/cleanup. Phase 4 is complete. Search, embeddings, pgvector, retrieval, and RAG remain deferred to Phase 5.
- **Dependencies:** Phase 3.

### Implementation prompt

```text
Design and implement ingestion only for the file types justified by repository requirements, starting with plain text/Markdown. Inspect installed libraries before adding parsers. Add private storage abstraction, validation, version/job state, deterministic chunking, failure/retry handling, and tests. Do not enable Tutor retrieval or embeddings until the content lifecycle is proven. Preserve access control and SQLite rollback.
```

## Phase 5 - Search, RAG, and knowledge base

- **Objective:** retrieve authorized published content with citations, without generating Tutor answers.
- **Implemented:** provider-neutral retrieval contract, conservative query normalization, authenticated `/api/knowledge/search`, PostgreSQL `tsvector`/GIN search with `ts_rank`, deterministic SQLite fallback, authorization-first version selection, source references, and Tutor context-provider integration.
- **Database:** generated `content_chunks.search_vector`, GIN index, server-only `search_published_content` RPC.
- **Security:** browser identity is ignored; Express session identity, course memberships, published resource state, current version, successful extraction, and course visibility are required before chunk search.
- **Tests:** deterministic fixture matrix, HTTP auth/identity boundary, provenance, version safety, no-source behavior, Tutor context boundary, and live Supabase RPC proof.
- **Acceptance:** Phase 5 is complete only for keyword retrieval. It does not add embeddings, pgvector, semantic search, hybrid retrieval, reranking, or real model calls.
- **Dependencies:** Phases 2 and 4.

### Implementation prompt

```text
Implement server-side keyword retrieval over published content chunks with course/access filters and citation metadata. Use real schema and repository evidence; do not automatically install pgvector or a vector service. Integrate retrieval into the existing Tutor orchestrator only after authorization filtering. Add no-source/refusal and citation tests. Do not expose raw private documents or secrets.
```

## Phase 6 - Smarter Tutor orchestration

- **Objective:** add course/topic context, Socratic modes, diagnostics, practice generation, and grounded explanations.
- **Evidence:** current Tutor has only a mock course selector and placeholder response.
- **Create:** policy/mode modules, structured tool/action schemas, validation/evaluation fixtures.
- **Modify:** Tutor page/API/orchestrator.
- **Database:** use existing content/conversation tables; add events as needed.
- **API:** mode, course, topic, and action fields with server validation.
- **Frontend:** mode controls, citations, practice flow, feedback.
- **AI:** prompt templates with explicit source boundaries and structured output validation.
- **Security:** abuse limits, content access, prompt injection handling.
- **Tests:** golden scenarios for explanation, hint, quiz, refusal, citation.
- **Acceptance:** responses are grounded, mode-aware, and testable.
- **Dependencies:** Phase 5.

### Implementation prompt

```text
Upgrade the Tutor orchestrator using the proven retrieval and conversation contracts. Add explicit pedagogical modes and structured outputs for explanation, hint, practice, and review. Keep source grounding, citations, refusal behavior, authorization, limits, and fake-provider tests. Do not introduce ML mastery or recommendations yet. Validate with a small golden evaluation set plus full repository checks.
```

## Phase 7 - Student learning memory and personalization

- **Objective:** derive useful, explainable student context.
- **Evidence:** current analytics are one denormalized snapshot; no events, attempts, or topic mastery exist.
- **Create:** learning events, quiz attempts/answers, topic mastery derivation, Tutor feedback.
- **Modify:** quiz/flashcard/planner/Tutor flows and repositories.
- **Database:** user/topic/time indexes and retention rules.
- **API:** event ingestion and mastery summaries.
- **Frontend:** explainable strengths/weaknesses and feedback controls.
- **AI:** context selection, not autonomous high-stakes decisions.
- **Tests:** idempotency, privacy, calculation fixtures, cross-user isolation.
- **Acceptance:** Tutor can explain why a topic is recommended using stored signals.
- **Dependencies:** Phases 2, 5, and 6.

### Implementation prompt

```text
Add event and assessment instrumentation only where actual UI actions exist. Derive deterministic topic/course signals with explainable formulas before considering ML. Add privacy/access tests and avoid collecting unnecessary personal data. Feed a bounded mastery summary into Tutor context. Do not change grades or silently infer outcomes. Preserve provider parity.
```

## Phase 8 - Learning analytics

- **Objective:** replace opaque snapshots with event-derived, auditable analytics.
- **Evidence:** `analytics_snapshots` stores aggregate JSON; dashboard consumes it.
- **Create:** deterministic aggregation jobs/read models and analytics tests.
- **Modify:** analytics repository/API/page.
- **Database:** event indexes and aggregation timestamps.
- **API:** preserve existing response shape while adding optional explainable detail.
- **AI:** none required.
- **Security:** student self-view, lecturer scoped aggregates, admin policy.
- **Tests:** fixture events, timezone/date boundaries, null semantics.
- **Acceptance:** metrics reconcile to event fixtures and do not regress current UI.
- **Dependencies:** Phase 7.

### Implementation prompt

```text
Make analytics event-derived without breaking the current Analytics API contract. Inspect existing snapshot consumers and preserve response fields. Add deterministic aggregation, scoped access, reconciliation tests, and migration/backfill handling. Do not introduce predictive ML or redesign charts in this phase.
```

## Phase 9 - Recommendation and adaptive learning

- **Objective:** recommend next-best actions using explainable signals.
- **Evidence:** study plan, videos, flashcards, quizzes, and analytics exist but are not ranked for a user.
- **Create:** recommendation service/records and feedback.
- **Modify:** dashboard, planner, Tutor, video/quiz surfaces.
- **Database:** recommendation records and rationale metadata.
- **API:** recommendation read/feedback endpoints.
- **AI:** deterministic ranking first; LLM explanation optional.
- **Security:** only authorized course content.
- **Tests:** ranking fixtures, cold start, feedback, stale data.
- **Acceptance:** every recommendation has a reason and can be dismissed.
- **Dependencies:** Phases 7 and 8.

### Implementation prompt

```text
Implement explainable deterministic next-best-action recommendations from existing study-plan, assignment, quiz, and mastery signals. Start with rules and scoring, not ML. Add rationale, dismissal/feedback, access filtering, cold-start tests, and preserve current API/UI behavior. Defer model-based ranking until measurement exists.
```

## Phase 10 - AI evaluation and optimization

- **Objective:** make Tutor quality measurable before scale.
- **Evidence:** no AI evaluation or model telemetry exists.
- **Create:** versioned golden dataset, evaluator harness, latency/cost/grounding telemetry with privacy controls.
- **Modify:** model adapter/orchestrator tests and reports.
- **Database:** optional aggregate evaluation records; avoid storing raw sensitive prompts by default.
- **API:** no public contract required.
- **AI:** compare prompts/models/retrieval settings.
- **Security:** redact secrets/PII and restrict evaluation data.
- **Tests:** factuality, grounding, citation, refusal, relevance, pedagogy, latency.
- **Acceptance:** changes have repeatable quality and regression evidence.
- **Dependencies:** Phase 6 and retrieval.

### Implementation prompt

```text
Build a small repeatable Tutor evaluation harness around the existing fake/provider contract and grounded fixtures. Measure factuality, grounding, citation correctness, refusal behavior, relevance, latency, and cost metadata without exposing user secrets. Do not optimize blindly or add a new model provider without evidence. Report regressions clearly.
```

## Phase 11 - Advanced ML

- **Objective:** consider statistical mastery prediction, adaptive difficulty, or ranking only after data sufficiency.
- **Evidence:** no labeled event history or ML infrastructure exists.
- **Create:** only after a measured need and data review.
- **Modify/database/API/frontend:** scope per approved experiment.
- **AI:** separate predictive models from LLM features.
- **Security:** bias, explainability, educational impact, retention.
- **Tests:** offline metrics, calibration, drift, fallback behavior.
- **Acceptance:** deterministic baseline is beaten on held-out data and failure fallback is safe.
- **Dependencies:** all instrumentation, analytics, and evaluation phases.

### Implementation prompt

```text
Do not implement advanced ML until the repository contains sufficient evaluated learning events and a deterministic baseline. First produce a data sufficiency and experiment design report. If approved, add one narrow offline model with held-out evaluation, explainability, fallback behavior, privacy review, and no changes to grades or authorization.
```

## Recommended implementation order

1. Phase 0 contract and baseline.
2. Phase 1 server Tutor seam.
3. Phase 2 conversations and resource metadata.
4. Phase 3 staff content management.
5. Phase 4 ingestion.
6. Phase 5 keyword retrieval and citations.
7. Phase 6 grounded Tutor behavior.
8. Phase 7 learning events/mastery.
9. Phase 8 analytics.
10. Phase 9 recommendations.
11. Phase 10 evaluation.
12. Phase 11 advanced ML only if evidence supports it.

## Open risks

- Existing mock fallbacks can hide failures.
- The source database has authoritative text only for the Phase 4 text-ingestion subset; raw binary storage and PDF/DOCX/PPTX extraction are not implemented.
- Course membership/access is modeled for the current resource workflow.
- Existing roles are server-enforced for current admin routes, but future content routes must retain that discipline.
- Uploaded educational content creates privacy, copyright, malware, and retention obligations.
- LLM quality cannot be assessed until a real provider and evaluation set exist.

## Final assessment

- **Current state:** polished shell and seeded academic CRUD, mock Tutor.
- **Biggest gaps:** no server AI, no retrieval, no conversation memory, no event instrumentation, and no binary storage/async retry lifecycle for ingestion.
- **Highest-value improvements:** authoritative content lifecycle, keyword retrieval/citations, provider-neutral Tutor orchestrator, learning events, deterministic personalization.
- **Recommended order:** contracts -> content metadata -> staff management -> ingestion -> retrieval -> Tutor -> signals -> analytics/recommendations -> evaluation -> ML.
- **Files created:** `AI_TUTOR_AUDIT.md`, `AI_LEARNING_DATA_INVENTORY.md`, `AI_CONTENT_ARCHITECTURE.md`, `AI_TUTOR_IMPROVEMENT_PLAN.md`.
- **Open risks:** access control, private content retention, parser security, model quality, and the current reliance on mock fallbacks.
