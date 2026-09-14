# StudyHub AI Learning Data Inventory

## Evidence labels

- **CONFIRMED FROM SOURCE**: present in active schema, seed, route, or consumer code.
- **UNAVAILABLE**: no source evidence found.
- **RECOMMENDED**: future collection or modeling proposal.

## Student and academic data

| Data | Current source | Owner/relationship | Tutor currently uses it | Assessment |
|---|---|---|---|---|
| User identity/role | `users` | User-owned | No | Available; needed for authorization |
| Program/year/department | `users` | User profile | No | Available but sparse |
| Course enrollment | No enrollment table; course list is global | Not modeled | No | Missing |
| Course progress | `courses.progress` | Course-level aggregate | No | Available but not student-specific |
| Notes | `notes` | Course metadata only | No | Metadata only; no text body |
| Assignments | `assignments` | Course-level | No | Status/grade exists; no submission artifact or feedback |
| Quizzes | `quizzes`, `quiz_questions` | Course-level | No | Questions and explanations exist |
| Quiz attempts | No table | Missing | No | Critical gap |
| Flashcards | `flashcards` | Course/deck | No | Content exists; review events missing |
| Videos | `videos` | Course-level | No | Seeded recommendation metadata; no watch events |
| Study plan | `study_plan` | User-owned tasks | No | Completion exists; no history or time spent |
| Forum | `forum_threads`, `forum_replies` | Course/community | No | Questions can become future signals; no tutor linkage |
| Analytics | `analytics_snapshots` | User snapshot | No | Aggregate JSON; not event-derived |
| Streak | `users.streak` and analytics | User | No | Stored aggregate; calculation provenance unclear |
| Tutor conversations | None | Missing | N/A | Critical gap |
| Tutor feedback | None | Missing | N/A | Critical gap |
| Weak topics | None | Missing | N/A | Must be derived after topic/assessment model |
| Time spent | None | Missing | N/A | Needed for engagement and scheduling |

## Current schema and relationships

The verified Supabase schema mirrors the SQLite model. Core relationships are:

```text
users 1---* study_plan
users 1---* sessions
users 1---* analytics_snapshots
courses 1---* notes
courses 1---* assignments
courses 1---* quizzes
quizzes 1---* quiz_questions
courses 1---* flashcards
courses 1---* videos
courses 1---* forum_threads
forum_threads 1---* forum_replies
```

`course_memberships`, `learning_resources`, `content_versions`, `content_processing_jobs`, and `content_chunks` are present in the active SQLite bootstrap and Supabase migration. Phase 4B also stores private object references, checksums, byte sizes, processing state, retry attempts, character offsets, section labels, PDF page numbers, and PPTX slide numbers.

## AI interaction data

### Confirmed

- `ai_generated` booleans on quiz and flashcard rows.
- Mock Tutor messages in `src/lib/mockData.ts`.
- Static suggested questions in `src/content/pages/ai_tutor.json`.
- Quiz explanations are content fields, not model traces.

### Unavailable

- Prompt and model version.
- Provider request/response IDs.
- Token/cost/latency metrics.
- Conversation turns.
- Retrieval queries/results.
- Citation references.
- Helpful/unhelpful feedback.
- Generated-content provenance.
- Moderation/refusal outcomes.

### Phase 4 confirmed

- Lecturer/admin text ingestion creates a version, completed extraction job, and normalized chunks.
- Multipart TXT, Markdown, PDF, DOCX, and PPTX ingestion is implemented and covered by isolated fixtures.
- Failed processing persists bounded error text and retryable job state; temporary upload files are cleaned up.
- Student retrieval, search, embeddings, pgvector, and RAG remain unavailable and deferred.
- Live Supabase RLS and Storage deny-by-default posture is confirmed in `SUPABASE_SECURITY_REVIEW.md`; no browser role can directly read or mutate Phase 4 content tables.
- A live synthetic content transaction verified membership, resource, version, processing-job, chunk relationships and draft exclusion, then rolled back without leaving rows.
- Phase 5 now derives authorized retrieval candidates from memberships and authoritative published/current/completed version state, then searches `content_chunks` with PostgreSQL FTS or the equivalent SQLite fallback.
- Retrieval results preserve resource/version/chunk IDs, title, course, page/slide, heading, publication timestamp, relevance score, and citation reference. No LLM or semantic embedding data is collected.

## Data currently collected but unused by Tutor

- Course progress and course counters.
- Notes metadata.
- Assignment status and grades.
- Quiz best scores, questions, and explanations.
- Flashcard content.
- Video relevance metadata.
- Study-plan tasks.
- Analytics JSON arrays.
- Forum questions and lecturer replies.

The Tutor has no API query at all, so all of the above are unused by it.

## Data needed for a smarter Tutor

### MVP instrumentation

1. `course_memberships`: user/course access and role/term.
2. `learning_events`: content opened, quiz started/completed, flashcard reviewed, plan task completed, Tutor turn submitted.
3. `quiz_attempts` and `quiz_attempt_answers`: item-level correctness and timestamps.
4. `tutor_conversations` and `tutor_messages`: durable, user-owned history with model/prompt metadata separated from visible content.
5. `learning_resources` and `content_versions`: authoritative content identity, visibility, publication, provenance, and version.
6. `content_chunks`: extracted searchable text tied to resource/version.

### Later derived data

- `student_topic_mastery`: deterministic score first, model-backed later.
- `recommendation_records`: explainable next-best-action records.
- `ai_feedback`: response quality/helpfulness feedback.
- `content_processing_jobs`: retryable ingestion state.

## Retention and privacy recommendations

- Keep conversation and event data user-scoped and access-controlled.
- Store minimal prompt/response metadata needed for evaluation and debugging.
- Define retention for raw uploaded files, extracted text, and Tutor messages separately.
- Do not store secrets or provider credentials in learning records.
- Treat grades, learning behavior, and Tutor history as sensitive educational data.

## Data quality risks

- Current snapshot arrays can drift from underlying assignments/quizzes.
- `courses.progress` is not tied to a student enrollment.
- Notes contain no body text, so retrieval cannot use them.
- Forum author strings are denormalized rather than user foreign keys.
- Most academic dates are seed/static values.
- No audit trail proves who authored or published content.

## Recommended collection order

1. Content/resource ownership and publication metadata.
2. Course membership/access rules.
3. Assessment attempts and learning events.
4. Tutor conversations/messages.
5. Extracted text/chunks and citations.
6. Derived mastery and recommendation tables.

## What should remain deterministic first

Grades, completion rates, due-date prioritization, quiz accuracy, spaced-review scheduling, and basic weak-topic thresholds should begin as deterministic analytics. ML should only be introduced after event coverage and evaluation data exist.
