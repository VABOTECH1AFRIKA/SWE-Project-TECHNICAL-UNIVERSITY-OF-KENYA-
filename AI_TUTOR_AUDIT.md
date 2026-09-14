# StudyHub AI Tutor Audit

## Scope and evidence standard

This audit is source-first. `CONFIRMED FROM SOURCE` means the behavior is directly visible in active code, routes, schemas, or imports. `INFERRED FROM ARCHITECTURE` means a likely consequence of the current structure. `RECOMMENDED FUTURE DESIGN` is intentionally not implemented here.

## Executive answer

**What can the AI Tutor actually do today?**

It can display a mock conversation, let a user select one of four mock courses, append a user message locally, wait 1.8 seconds, and append a hard-coded assistant response saying that backend integration is pending. Phase 0 now also exposes an authenticated deterministic contract endpoint, but that endpoint does not call an LLM, retrieval system, database context, or conversation store.

## Current flow

```text
Student
  -> src/pages/ai-tutor.tsx
  -> local React state and mockAITutorMessages
  -> setTimeout(...)
  -> hard-coded placeholder response
  -> rendered chat bubble
```

There is now a `/api/ai/tutor` Phase 0/1 contract route, fake model provider, structured prompt boundary, replaceable empty context provider, normalized provider-error boundary, and server orchestrator. There is still no real model client, retrieval system, conversation table, or populated learning context.

## Capability matrix

| Capability | Exists | Evidence | Limitation | Priority |
|---|---|---|---|---|
| Tutor UI | Yes | `src/pages/ai-tutor.tsx` | Presentation only | P0 |
| Course selector | Mock only | `mockCourses` in `src/lib/mockData.ts` | Not loaded from current user or API | P0 |
| Chat input | Yes | `sendMessage` in `src/pages/ai-tutor.tsx` | Local state only | P0 |
| LLM response | No | `src/server/ai/model-provider.ts` contains only `FakeModelProvider` | Deterministic contract response only | P0 |
| Conversation history | Session-local only | `messages` React state | Lost on refresh; no user ownership | P0 |
| Course context | Boundary only | `TutorRequest.courseId`, UI selector, empty `TutorContextProvider` | No notes or course retrieval | P0 |
| Notes context | No | Notes API exists in `src/lib/api.ts`, but Tutor does not call it | No grounding | P0 |
| Assignments context | No | Assignment API exists, not consumed by Tutor | No deadline/problem context | P1 |
| Quiz context | No | Quiz API exists, not consumed by Tutor | No mistakes or question context | P1 |
| Flashcard context | No | Flashcard API exists, not consumed by Tutor | No mastery signal | P1 |
| Video context | No | Video API exists, not consumed by Tutor | Recommendations are seeded data | P2 |
| Study-plan context | No | Protected study-plan API exists | No next-action awareness | P1 |
| Analytics context | No | Analytics API exists | No personalization from progress | P1 |
| Previous mistakes | No | No attempt/result event model | Cannot diagnose misconceptions | P1 |
| Adaptive explanation | No | Hard-coded answer | No level or preference model | P1 |
| Socratic guidance | No | No tutor policy or turn state | No pedagogy control | P1 |
| Practice generation | No | `aiGenerated` is a stored flag on seeded quizzes/cards | No generator | P1 |
| Citations | No | No source-reference type or UI | Cannot show evidence | P0 |
| Hallucination control | No | No retrieval or refusal policy | Unbounded future model risk | P0 |
| Course-authoritative grounding | No | No material text/chunk tables | No knowledge base | P0 |
| Tutor memory | No | No tutor tables | No durable learner memory | P2 |
| Learning outcomes | No | No outcome/topic model | Analytics are aggregate snapshots | P2 |

## Existing relevant inventory

### Frontend

- `src/pages/ai-tutor.tsx`: active Tutor page; mock messages, mock course selector, placeholder response, `dangerouslySetInnerHTML` markdown-like renderer.
- `src/content/pages/ai_tutor.json`: five static suggested questions.
- `src/content/schemas.ts`: validates the suggested-question content shape.
- `src/routes.tsx`: mounts `/ai-tutor` under the student dashboard.
- `src/lib/api.ts`: active API client for courses, notes, assignments, quizzes, flashcards, videos, study plan, analytics, forum, admin, and auth. No Tutor API methods.
- `src/lib/mockData.ts`: mock users, courses, notes, assignments, quizzes, flashcards, videos, study plan, analytics, and Tutor messages. Several pages retain fallback mock data when queries fail.

### Server and data access

- `src/server/entry.ts`: mounts the Express API router at `/api`.
- `src/server/api/studyhub-sqlite.ts`: current route surface delegated through `dataAccess`; includes auth, protected routes, academic reads, study-plan/forum writes, and admin operations.
- `src/server/data/index.ts`: provider-aware SQLite/Supabase repositories. It currently covers users, courses, notes, assignments, quizzes/questions, flashcards, videos, study plan, analytics, forum, admin, and sessions.
- `src/server/auth/session.ts`: server-side cookie/session model now delegates session operations through `dataAccess`; it is not Supabase Auth.
- `src/server/api/studyhub-data.ts`: in-memory demo router, not mounted by `src/server/entry.ts`; must not be treated as production data.
- `src/server/api/studyhub-proxy.ts`: optional Python proxy, not mounted by the current entrypoint.

### Database/content

- `src/server/db/migrate-and-seed.ts`: canonical SQLite DDL and seed data.
- `supabase/migrations/001_initial_schema.sql`: verified Postgres reproduction of the flat SQLite model.
- Tables currently cover `users`, `courses`, `notes`, `assignments`, `quizzes`, `quiz_questions`, `flashcards`, `videos`, `study_plan`, `forum_threads`, `forum_replies`, `analytics_snapshots`, and `sessions`.
- There are no modules, topics, lessons, embeddings, tutor conversations, tutor messages, learning events, mastery records, recommendation records, or AI feedback tables. Phase 4 now adds learning resources, content versions, processing-job metadata, and extracted text chunks; binary file storage and non-text extraction remain unavailable.

## Existing data signals

Available: user role/profile, course progress counters, notes metadata, assignment status/grade, quiz best score and question explanations, flashcard content, video relevance, study-plan completion, forum posts/replies, and one analytics snapshot with aggregate JSON arrays.

Not available: per-attempt quiz answers, timestamps for most learning actions, time-on-content, flashcard review outcomes persisted to the server, topic-level mastery, tutor interactions, question feedback, content provenance, content ownership, content publication state, or document text.

## Implemented In Phase 1

- `TutorExecutionContext` separates authenticated identity and normalized request from future learning context.
- `TutorContextProvider` is replaceable; the current implementation returns empty context and sources.
- Prompt assembly separates trusted system/mode policy from untrusted user/context/source content.
- Provider responses are normalized and provider failures are converted to safe orchestration errors.
- Input limits cover message and optional context fields; mode validation is explicit.
- No-op observability records safe timing/provider/mode metadata without recording private content.

## Current limitations and technical debt

1. The Tutor UI claims contextual tutoring but explicitly displays `Placeholder - AI backend pending`.
2. A client-side HTML renderer uses `dangerouslySetInnerHTML` for generated-looking content; a future model response must use a safe Markdown renderer or escaped text.
3. Page fallbacks to mock data can conceal API failures in development and production.
4. `aiGenerated` flags identify seed labels, not generation provenance or model execution.
5. `analytics_snapshots` is a denormalized snapshot, not an event-derived learning model.
6. The academic model uses course codes as foreign-key targets and has no topic hierarchy.
7. Lecturer Upload buttons and Generate Quiz actions in `src/pages/lecturer.tsx` are visual controls without handlers or routes.
8. Admin manages users/statuses only; course/content management tabs are UI shells.
9. The frontend API has notifications methods, but the active SQLite router/data repository does not expose a matching notifications implementation.

## Recommended target flow

```text
Student
  -> Tutor UI
  -> authenticated Express Tutor API
  -> Tutor orchestrator
       -> authorized student/course context
       -> deterministic learning signals
       -> conversation memory
       -> filtered retrieval from published content
       -> LLM provider
       -> citation/refusal/quality validation
  -> response plus source references and optional learning event
```

This is a recommendation, not current functionality.

## Highest-value next steps

1. Define a narrow Tutor API and conversation contract.
2. Add authoritative content/resource metadata before adding embeddings.
3. Add event and assessment-attempt instrumentation.
4. Build ingestion and retrieval for published course material.
5. Add grounded Tutor orchestration with citations and refusal behavior.
6. Add evaluation fixtures before expanding personalization or ML.
