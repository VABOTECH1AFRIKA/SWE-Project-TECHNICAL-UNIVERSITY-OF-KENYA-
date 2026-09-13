# StudyHub AI — Supabase Schema Plan

## 1. Database Architecture

### Runtime architecture confirmed

The current repository is a Vite + React + Express application with SQLite as the live runtime database. The verified runtime path is:

React UI -> Express API -> SQLite-backed route handlers -> SQLite files (`src/server/db/sqlite-schema.ts`, `src/server/db/sqlite-client.ts`, `src/server/db/migrate-and-seed.ts`)

Express remains responsible for:
- authentication
- sessions
- authorization
- validation
- business logic
- API contracts

Supabase Postgres should remain responsible for:
- persistent relational data
- tables
- constraints
- relationships
- indexes
- transactions

This plan is preparation only. It does not connect the app to Supabase, migrate data, or change the current SQLite runtime.

---

## 2. Current Schema Inventory

### 2.1 Tables discovered

Table inventory from `src/server/db/sqlite-schema.ts` plus the runtime-created session table in `src/server/auth/session.ts`.

#### Application tables in SQLite schema

1. `users`
   - Purpose: authenticated users and profile metadata
   - Current columns:
     - `id` (TEXT, PK)
     - `name` (TEXT, NOT NULL)
     - `email` (TEXT, NOT NULL, UNIQUE)
     - `password_hash` (TEXT, NOT NULL)
     - `role` (TEXT, NOT NULL, default `student`)
     - `avatar` (TEXT, NOT NULL, default `''`)
     - `program` (TEXT, default `''`)
     - `year` (INTEGER, default `1`)
     - `department` (TEXT, default `''`)
     - `streak` (INTEGER, NOT NULL, default `0`)
     - `status` (TEXT, NOT NULL, default `active`)
     - `joined` (TEXT, NOT NULL, default `(date('now'))`)
     - `created_at` (TEXT, NOT NULL, default `(datetime('now'))`)
   - Reads/writes:
     - `src/server/api/studyhub-sqlite.ts` `POST /auth/register`, `POST /auth/login`, `GET /user/me`, `GET /admin/users`, `PATCH /admin/users/:id/status`
     - `src/server/auth/session.ts` joins `users` to validate sessions
     - `src/server/db/migrate-and-seed.ts` seeds demo users

2. `courses`
   - Purpose: catalog of academic courses
   - Columns:
     - `id` (TEXT, PK)
     - `code` (TEXT, NOT NULL, UNIQUE)
     - `title` (TEXT, NOT NULL)
     - `color` (TEXT, NOT NULL, default `#1F6F6B`)
     - `progress` (INTEGER, NOT NULL, default `0`)
     - `notes_count` (INTEGER, NOT NULL, default `0`)
     - `assignments_count` (INTEGER, NOT NULL, default `0`)
     - `icon` (TEXT, NOT NULL, default `BookOpen`)
     - `lecturer` (TEXT, NOT NULL, default `''`)
   - Reads/writes:
     - `GET /courses`, `GET /courses/:id`
     - `src/server/db/migrate-and-seed.ts` seeds `CS301`..`CS304`

3. `notes`
   - Purpose: note records associated with a course
   - Columns:
     - `id` (TEXT, PK)
     - `title` (TEXT, NOT NULL)
     - `course` (TEXT, NOT NULL, FK -> `courses.code`)
     - `type` (TEXT, NOT NULL, default `pdf`)
     - `date` (TEXT, NOT NULL)
     - `size` (TEXT, NOT NULL, default `''`)
     - `pages` (INTEGER, NOT NULL, default `0`)
   - Reads/writes:
     - `GET /notes`
     - seed data in `src/server/db/migrate-and-seed.ts`

4. `assignments`
   - Purpose: assignment tracking per course
   - Columns:
     - `id` (TEXT, PK)
     - `title` (TEXT, NOT NULL)
     - `course` (TEXT, NOT NULL, FK -> `courses.code`)
     - `due_date` (TEXT, NOT NULL)
     - `status` (TEXT, NOT NULL, default `pending`)
     - `grade` (REAL, nullable)
     - `max_grade` (REAL, NOT NULL, default `100`)
     - `weight` (TEXT, NOT NULL, default `''`)
   - Reads/writes:
     - `GET /assignments`
     - seed data in `src/server/db/migrate-and-seed.ts`

5. `quizzes`
   - Purpose: quiz metadata
   - Columns:
     - `id` (TEXT, PK)
     - `title` (TEXT, NOT NULL)
     - `course` (TEXT, NOT NULL, FK -> `courses.code`)
     - `difficulty` (TEXT, NOT NULL, default `Medium`)
     - `question_count` (INTEGER, NOT NULL, default `0`)
     - `duration` (INTEGER, NOT NULL, default `10`)
     - `best_score` (REAL, nullable)
     - `ai_generated` (INTEGER, NOT NULL, default `0`)
   - Reads/writes:
     - `GET /quizzes`, `GET /quizzes/:id`
     - seed data in `src/server/db/migrate-and-seed.ts`

6. `quiz_questions`
   - Purpose: per-quiz question definitions and answer options
   - Columns:
     - `id` (TEXT, PK)
     - `quiz_id` (TEXT, NOT NULL, FK -> `quizzes.id`)
     - `question` (TEXT, NOT NULL)
     - `options` (TEXT, NOT NULL, JSON array stored as text)
     - `correct` (INTEGER, NOT NULL)
     - `explanation` (TEXT, NOT NULL, default `''`)
     - `order_idx` (INTEGER, NOT NULL, default `0`)
   - Reads/writes:
     - `GET /quizzes`, `GET /quizzes/:id`
     - `JSON.parse(qq.options)` is used in `src/server/api/studyhub-sqlite.ts`

7. `flashcards`
   - Purpose: flashcard sets keyed by course code
   - Columns:
     - `id` (TEXT, PK)
     - `deck` (TEXT, NOT NULL, FK -> `courses.code`)
     - `front` (TEXT, NOT NULL)
     - `back` (TEXT, NOT NULL)
     - `ai_generated` (INTEGER, NOT NULL, default `0`)
   - Reads/writes:
     - `GET /flashcards`
     - seed data in `migrate-and-seed.ts`

8. `videos`
   - Purpose: course video index metadata
   - Columns:
     - `id` (TEXT, PK)
     - `title` (TEXT, NOT NULL)
     - `channel` (TEXT, NOT NULL)
     - `thumbnail` (TEXT, NOT NULL, default `''`)
     - `duration` (TEXT, NOT NULL, default `''`)
     - `views` (TEXT, NOT NULL, default `''`)
     - `relevance` (INTEGER, NOT NULL, default `90`)
     - `course` (TEXT, NOT NULL, FK -> `courses.code`)
     - `uploaded_ago` (TEXT, NOT NULL, default `''`)
   - Reads/writes:
     - `GET /videos`

9. `study_plan`
   - Purpose: per-user tasks and study plan items
   - Columns:
     - `id` (TEXT, PK)
     - `user_id` (TEXT, NOT NULL, FK -> `users.id`)
     - `title` (TEXT, NOT NULL)
     - `course` (TEXT, NOT NULL, FK -> `courses.code`)
     - `due_date` (TEXT, NOT NULL)
     - `time` (TEXT, NOT NULL, default `09:00`)
     - `duration` (INTEGER, NOT NULL, default `60`)
     - `type` (TEXT, NOT NULL, default `study`)
     - `completed` (INTEGER, boolean, NOT NULL, default `0`)
   - Reads/writes:
     - `GET /study-plan`, `POST /study-plan`, `PATCH /study-plan/:id/toggle`

10. `forum_threads`
    - Purpose: forum discussion threads
    - Columns:
      - `id` (TEXT, PK)
      - `title` (TEXT, NOT NULL)
      - `course` (TEXT, NOT NULL, FK -> `courses.code`)
      - `author` (TEXT, NOT NULL)
      - `author_role` (TEXT, NOT NULL, default `student`)
      - `views` (INTEGER, NOT NULL, default `0`)
      - `tags` (TEXT, NOT NULL, default `'[]'`, JSON array stored as text)
      - `solved` (INTEGER, boolean, NOT NULL, default `0`)
      - `last_activity` (TEXT, NOT NULL, default `''`)
      - `content` (TEXT, NOT NULL, default `''`)
      - `created_at` (TEXT, NOT NULL, default `(datetime('now'))`)
    - Reads/writes:
      - `GET /forum`, `GET /forum/:id`, `POST /forum`
      - `JSON.parse(t.tags)` is used in `studyhub-sqlite.ts`

11. `forum_replies`
    - Purpose: replies beneath a thread
    - Columns:
      - `id` (TEXT, PK)
      - `thread_id` (TEXT, NOT NULL, FK -> `forum_threads.id`)
      - `author` (TEXT, NOT NULL)
      - `author_role` (TEXT, NOT NULL, default `student`)
      - `content` (TEXT, NOT NULL)
      - `timestamp` (TEXT, NOT NULL, default `(datetime('now'))`)
    - Reads/writes:
      - `GET /forum`, `GET /forum/:id`, `POST /forum/:id/replies`

12. `analytics_snapshots`
    - Purpose: per-user analytics summary snapshot
    - Columns:
      - `id` (TEXT, PK)
      - `user_id` (TEXT, NOT NULL, FK -> `users.id`)
      - `overall_grade` (REAL, NOT NULL, default `0`)
      - `quiz_average` (REAL, NOT NULL, default `0`)
      - `study_hours` (INTEGER, NOT NULL, default `0`)
      - `assignments_done` (INTEGER, NOT NULL, default `0`)
      - `assignments_total` (INTEGER, NOT NULL, default `0`)
      - `day_streak` (INTEGER, NOT NULL, default `0`)
      - `courses_active` (INTEGER, NOT NULL, default `0`)
      - `weekly_progress` (TEXT, NOT NULL, default `'[]'`, JSON)
      - `recent_quiz_scores` (TEXT, NOT NULL, default `'[]'`, JSON)
      - `subject_strengths` (TEXT, NOT NULL, default `'[]'`, JSON)
      - `radar_data` (TEXT, NOT NULL, default `'[]'`, JSON)
      - `updated_at` (TEXT, NOT NULL, default `(datetime('now'))`)
    - Reads/writes:
      - `GET /analytics`
      - `POST /auth/register` creates initial analytics row
      - `src/server/db/migrate-and-seed.ts` seeds `analyticsData`

#### Runtime session table created by auth/session.ts

13. `sessions`
   - Purpose: server-side session storage for authenticated users
   - Created at runtime in `src/server/auth/session.ts`
   - Columns:
     - `id` (TEXT, PK)
     - `id_hash` (TEXT, NOT NULL, UNIQUE)
     - `user_id` (TEXT, NOT NULL, FK -> `users.id`, cascade delete)
     - `expires_at` (TEXT, NOT NULL)
     - `created_at` (TEXT, NOT NULL, default `(datetime('now'))`)
     - `last_seen_at` (TEXT, NOT NULL, default `(datetime('now'))`)
   - Reads/writes:
     - `setAuthSession`, `revokeSession`, `requireAuth`, `getSessionUserFromToken`
     - `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`

### 2.2 SQLite-specific observations

- SQLite schema currently uses `TEXT` heavily for IDs and dates, even where Postgres would prefer `uuid` or `timestamptz`.
- Several fields are stored as JSON text (`options`, `tags`, `weekly_progress`, `recent_quiz_scores`, `subject_strengths`, `radar_data`).
- Boolean flags are represented as `INTEGER` (`ai_generated`, `completed`, `solved`).
- `courses.code` is used as a foreign key target across multiple tables, so that column is effectively a stable business identifier in the data model.
- `sessions` is not represented in `sqlite-schema.ts`; it is created dynamically by `src/server/auth/session.ts`.

---

## 3. SQLite → PostgreSQL Mapping

| SQLite Table | Supabase Table | Column | PostgreSQL Type | Nullable | Default | PK | FK | Unique | Index | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `users` | `users` | `id` | `uuid` or `text` | No | none | Yes | — | Yes (business key if kept as text) | — | Current app uses text IDs (`u1`, `u2`, `u...`) and `randomUUID()` fragments; PostgreSQL should likely normalize to `uuid` with generated default or keep text for compatibility. |
| `users` | `users` | `name` | `text` | No | none | — | — | — | — | Required profile name. |
| `users` | `users` | `email` | `text` | No | none | — | — | Yes | Yes | Unique email. |
| `users` | `users` | `password_hash` | `text` | No | none | — | — | — | — | Keep server-managed hash; do not expose. |
| `users` | `users` | `role` | `text` or `user_role` enum | No | `student` | — | — | — | Yes | Current values: `student`, `lecturer`, `admin`. |
| `users` | `users` | `avatar` | `text` | No | `''` | — | — | — | — | Simple display value. |
| `users` | `users` | `program` | `text` | Yes | `''` | — | — | — | — | Current nullable meaning is effectively empty string. |
| `users` | `users` | `year` | `integer` | Yes | `1` | — | — | — | — | Consider nullable if some users have no year. |
| `users` | `users` | `department` | `text` | Yes | `''` | — | — | — | — | Current empty-string default. |
| `users` | `users` | `streak` | `integer` | No | `0` | — | — | — | — | Not currently constrained. |
| `users` | `users` | `status` | `text` or enum | No | `active` | — | — | — | Yes | Current values: `active`, `suspended`. |
| `users` | `users` | `joined` | `date` or `timestamptz` | No | `CURRENT_DATE` | — | — | — | — | Current SQLite uses `date('now')`. |
| `users` | `users` | `created_at` | `timestamptz` | No | `now()` | — | — | — | — | Best mapped to PostgreSQL timestamp. |
| `courses` | `courses` | `id` | `uuid`/`text` | No | none | Yes | — | Yes | — | Current app uses text IDs such as `cs301`. |
| `courses` | `courses` | `code` | `text` | No | none | — | — | Yes | Yes | Business identifier used in foreign keys. |
| `courses` | `courses` | `title` | `text` | No | none | — | — | — | Yes | Used in list and search flows. |
| `courses` | `courses` | `color` | `text` | No | `#1F6F6B` | — | — | — | — | UI color token. |
| `courses` | `courses` | `progress` | `integer` | No | `0` | — | — | — | — | Numeric progress. |
| `courses` | `courses` | `notes_count` | `integer` | No | `0` | — | — | — | — | Derived count; likely maintained by app or trigger. |
| `courses` | `courses` | `assignments_count` | `integer` | No | `0` | — | — | — | — | Derived count; likely maintained by app or trigger. |
| `courses` | `courses` | `icon` | `text` | No | `BookOpen` | — | — | — | — | UI icon name. |
| `courses` | `courses` | `lecturer` | `text` | No | `''` | — | — | — | — | Current free text presenter name. |
| `notes` | `notes` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `notes` | `notes` | `title` | `text` | No | none | — | — | — | — | Required. |
| `notes` | `notes` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Use FK to `courses.code`. |
| `notes` | `notes` | `type` | `text` | No | `pdf` | — | — | — | — | Content type. |
| `notes` | `notes` | `date` | `date` or `text` | No | none | — | — | — | — | Current SQLite date string. |
| `notes` | `notes` | `size` | `text` | No | `''` | — | — | — | — | Current display string. |
| `notes` | `notes` | `pages` | `integer` | No | `0` | — | — | — | — | Numeric page count. |
| `assignments` | `assignments` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `assignments` | `assignments` | `title` | `text` | No | none | — | — | — | — | Required. |
| `assignments` | `assignments` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Existing foreign key. |
| `assignments` | `assignments` | `due_date` | `date`/`timestamptz` | No | none | — | — | — | — | Current SQLite string. |
| `assignments` | `assignments` | `status` | `text` | No | `pending` | — | — | — | Yes | Current statuses likely limited to known set. |
| `assignments` | `assignments` | `grade` | `numeric` | Yes | none | — | — | — | — | Nullable because not always graded. |
| `assignments` | `assignments` | `max_grade` | `numeric` | No | `100` | — | — | — | — | Common across assignments. |
| `assignments` | `assignments` | `weight` | `text` | No | `''` | — | — | — | — | Current display string such as `15%`. |
| `quizzes` | `quizzes` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `quizzes` | `quizzes` | `title` | `text` | No | none | — | — | — | Yes | Searchable listing. |
| `quizzes` | `quizzes` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Existing FK. |
| `quizzes` | `quizzes` | `difficulty` | `text` | No | `Medium` | — | — | — | — | Could become enum. |
| `quizzes` | `quizzes` | `question_count` | `integer` | No | `0` | — | — | — | — | Derived count. |
| `quizzes` | `quizzes` | `duration` | `integer` | No | `10` | — | — | — | — | In minutes. |
| `quizzes` | `quizzes` | `best_score` | `numeric` | Yes | none | — | — | — | — | Nullable. |
| `quizzes` | `quizzes` | `ai_generated` | `boolean` | No | `false` | — | — | — | — | Current integer-backed boolean. |
| `quiz_questions` | `quiz_questions` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `quiz_questions` | `quiz_questions` | `quiz_id` | `uuid`/`text` | No | none | — | `quizzes.id` | — | Yes | FK to quiz. |
| `quiz_questions` | `quiz_questions` | `question` | `text` | No | none | — | — | — | — | Required text. |
| `quiz_questions` | `quiz_questions` | `options` | `jsonb` | No | none | — | — | — | — | Recommended as `jsonb` in Postgres. |
| `quiz_questions` | `quiz_questions` | `correct` | `integer` | No | none | — | — | — | — | Index position of correct answer. |
| `quiz_questions` | `quiz_questions` | `explanation` | `text` | No | `''` | — | — | — | — | Optional explanation. |
| `quiz_questions` | `quiz_questions` | `order_idx` | `integer` | No | `0` | — | — | — | Yes | Ordering within quiz. |
| `flashcards` | `flashcards` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `flashcards` | `flashcards` | `deck` | `text` | No | none | — | `courses.code` | — | Yes | Course/key mapping. |
| `flashcards` | `flashcards` | `front` | `text` | No | none | — | — | — | — | Prompt/question. |
| `flashcards` | `flashcards` | `back` | `text` | No | none | — | — | — | — | Answer. |
| `flashcards` | `flashcards` | `ai_generated` | `boolean` | No | `false` | — | — | — | — | Current integer-backed boolean. |
| `videos` | `videos` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `videos` | `videos` | `title` | `text` | No | none | — | — | — | Yes | Title search. |
| `videos` | `videos` | `channel` | `text` | No | none | — | — | — | — | Source channel. |
| `videos` | `videos` | `thumbnail` | `text` | No | `''` | — | — | — | — | Optional metadata. |
| `videos` | `videos` | `duration` | `text` | No | `''` | — | — | — | — | String currently. |
| `videos` | `videos` | `views` | `text` | No | `''` | — | — | — | — | Current display string. |
| `videos` | `videos` | `relevance` | `integer` | No | `90` | — | — | — | — | Ranking score. |
| `videos` | `videos` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Existing FK. |
| `videos` | `videos` | `uploaded_ago` | `text` | No | `''` | — | — | — | — | Existing display string. |
| `study_plan` | `study_plan` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `study_plan` | `study_plan` | `user_id` | `uuid`/`text` | No | none | — | `users.id` | — | Yes | Per-user task list. |
| `study_plan` | `study_plan` | `title` | `text` | No | none | — | — | — | Yes | Task name. |
| `study_plan` | `study_plan` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Course binding. |
| `study_plan` | `study_plan` | `due_date` | `date`/`timestamptz` | No | none | — | — | — | Yes | Sorting and filtering. |
| `study_plan` | `study_plan` | `time` | `text` | No | `09:00` | — | — | — | — | Current time string. |
| `study_plan` | `study_plan` | `duration` | `integer` | No | `60` | — | — | — | — | Minutes. |
| `study_plan` | `study_plan` | `type` | `text` | No | `study` | — | — | — | Yes | Study/task classification. |
| `study_plan` | `study_plan` | `completed` | `boolean` | No | `false` | — | — | — | — | Integer-backed boolean. |
| `forum_threads` | `forum_threads` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `forum_threads` | `forum_threads` | `title` | `text` | No | none | — | — | — | Yes | Thread title. |
| `forum_threads` | `forum_threads` | `course` | `text` | No | none | — | `courses.code` | — | Yes | Course grouping. |
| `forum_threads` | `forum_threads` | `author` | `text` | No | none | — | — | — | — | Display author. |
| `forum_threads` | `forum_threads` | `author_role` | `text` | No | `student` | — | — | — | — | Role snapshot from current app. |
| `forum_threads` | `forum_threads` | `views` | `integer` | No | `0` | — | — | — | — | Counter. |
| `forum_threads` | `forum_threads` | `tags` | `jsonb` | No | `'[]'` | — | — | — | — | Recommended conversion from text JSON. |
| `forum_threads` | `forum_threads` | `solved` | `boolean` | No | `false` | — | — | — | — | Integer-backed boolean. |
| `forum_threads` | `forum_threads` | `last_activity` | `text` | No | `''` | — | — | — | — | Relative text display, not a normalized timestamp. |
| `forum_threads` | `forum_threads` | `content` | `text` | No | `''` | — | — | — | — | Freeform markdown/plain text. |
| `forum_threads` | `forum_threads` | `created_at` | `timestamptz` | No | `now()` | — | — | — | Yes | Best mapped to actual timestamp. |
| `forum_replies` | `forum_replies` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `forum_replies` | `forum_replies` | `thread_id` | `uuid`/`text` | No | none | — | `forum_threads.id` | — | Yes | Self-referencing relation to thread. |
| `forum_replies` | `forum_replies` | `author` | `text` | No | none | — | — | — | — | Display author. |
| `forum_replies` | `forum_replies` | `author_role` | `text` | No | `student` | — | — | — | — | Snapshot of role at reply time. |
| `forum_replies` | `forum_replies` | `content` | `text` | No | none | — | — | — | — | Reply body. |
| `forum_replies` | `forum_replies` | `timestamp` | `timestamptz` | No | `now()` | — | — | — | Yes | Best mapped to actual timestamp. |
| `analytics_snapshots` | `analytics_snapshots` | `id` | `uuid`/`text` | No | none | Yes | — | — | — | App-generated IDs. |
| `analytics_snapshots` | `analytics_snapshots` | `user_id` | `uuid`/`text` | No | none | — | `users.id` | — | Yes | One snapshot per user. |
| `analytics_snapshots` | `analytics_snapshots` | `overall_grade` | `numeric` | No | `0` | — | — | — | — | Numeric grade. |
| `analytics_snapshots` | `analytics_snapshots` | `quiz_average` | `numeric` | No | `0` | — | — | — | — | Numeric grade. |
| `analytics_snapshots` | `analytics_snapshots` | `study_hours` | `integer` | No | `0` | — | — | — | — | Numeric aggregate. |
| `analytics_snapshots` | `analytics_snapshots` | `assignments_done` | `integer` | No | `0` | — | — | — | — | Count. |
| `analytics_snapshots` | `analytics_snapshots` | `assignments_total` | `integer` | No | `0` | — | — | — | — | Count. |
| `analytics_snapshots` | `analytics_snapshots` | `day_streak` | `integer` | No | `0` | — | — | — | — | Streak count. |
| `analytics_snapshots` | `analytics_snapshots` | `courses_active` | `integer` | No | `0` | — | — | — | — | Course count. |
| `analytics_snapshots` | `analytics_snapshots` | `weekly_progress` | `jsonb` | No | `'[]'` | — | — | — | — | Structured analytics JSON. |
| `analytics_snapshots` | `analytics_snapshots` | `recent_quiz_scores` | `jsonb` | No | `'[]'` | — | — | — | — | Structured analytics JSON. |
| `analytics_snapshots` | `analytics_snapshots` | `subject_strengths` | `jsonb` | No | `'[]'` | — | — | — | — | Structured analytics JSON. |
| `analytics_snapshots` | `analytics_snapshots` | `radar_data` | `jsonb` | No | `'[]'` | — | — | — | — | Structured analytics JSON. |
| `analytics_snapshots` | `analytics_snapshots` | `updated_at` | `timestamptz` | No | `now()` | — | — | — | — | Actual timestamp. |
| `sessions` | `sessions` | `id` | `uuid`/`text` | No | none | Yes | — | Yes | — | Current token value stored as token string. |
| `sessions` | `sessions` | `id_hash` | `text` | No | none | — | — | Yes | Yes | SHA-256 hash of session token. |
| `sessions` | `sessions` | `user_id` | `uuid`/`text` | No | none | — | `users.id` | — | Yes | Current runtime session link. |
| `sessions` | `sessions` | `expires_at` | `timestamptz` | No | none | — | — | — | Yes | Current time-based expiry. |
| `sessions` | `sessions` | `created_at` | `timestamptz` | No | `now()` | — | — | — | — | Session created time. |
| `sessions` | `sessions` | `last_seen_at` | `timestamptz` | No | `now()` | — | — | — | — | Session refresh timestamp. |

---

## 4. Relationship Map

### One-to-many relationships discovered

- `users` -> `study_plan`
  - one user has many study-plan items
- `users` -> `analytics_snapshots`
  - one user has one analytics snapshot in the current schema
- `courses` -> `notes`
  - one course has many notes
- `courses` -> `assignments`
  - one course has many assignments
- `courses` -> `quizzes`
  - one course has many quizzes
- `courses` -> `flashcards`
  - one course has many flashcards
- `courses` -> `videos`
  - one course has many videos
- `courses` -> `forum_threads`
  - one course has many forum threads
- `courses` -> `study_plan`
  - one course has many study-plan rows
- `quizzes` -> `quiz_questions`
  - one quiz has many questions
- `forum_threads` -> `forum_replies`
  - one thread has many replies
- `users` -> `sessions`
  - one user can have many active session records (current app allows session tokens to accumulate until expiry/revocation)

### Self-referencing relationships

- `forum_replies.thread_id` -> `forum_threads.id`
  - replies belong to a thread

### Many-to-many relationships

- None currently modeled explicitly in the SQLite schema.
- The current app is essentially an aggregate data model with one-to-many relationships and course-scoped lookup patterns.

### Relationship notes

- `courses.code` is used as the foreign-key target in multiple tables, so this is a stronger relationship surface than `courses.id` in the current schema design.
- `forum_threads.course` and `forum_replies.thread_id` are both meaningful for route-level queries.
- `users.status` and `users.role` are effectively controlled vocabularies but are currently stored as text, not enums.

---

## 5. Authentication / Session Storage

The current auth/session model is server-enforced and stored in SQLite. The application does not use Supabase Auth.

### Current model

- `src/server/auth/session.ts` creates a runtime table named `sessions`
- Session values are stored as:
  - `id`: random token
  - `id_hash`: SHA-256 hash of the token
  - `user_id`: linked to `users.id`
  - `expires_at`, `created_at`, `last_seen_at`
- `requireAuth()` validates the cookie and fetches the user from `sessions` + `users`
- `requireRole()` enforces `student`, `lecturer`, or `admin`

### PostgreSQL mapping recommendation

- Preserve the existing session model exactly for the first Supabase migration phase.
- Store all session rows in Postgres, but keep Express responsible for authentication/session verification.
- Do not introduce Supabase Auth during the initial migration.
- Keep `sessions.id_hash` as a SHA-256 hash and continue generating a secure random token string in Express.

---

## 6. Constraints

### Existing constraints discovered

- Primary keys:
  - all tables have `id` as primary key
  - `users.email` unique
  - `courses.code` unique
- Foreign keys:
  - `notes.course` -> `courses.code`
  - `assignments.course` -> `courses.code`
  - `quizzes.course` -> `courses.code`
  - `quiz_questions.quiz_id` -> `quizzes.id`
  - `flashcards.deck` -> `courses.code`
  - `videos.course` -> `courses.code`
  - `study_plan.user_id` -> `users.id`
  - `study_plan.course` -> `courses.code`
  - `forum_threads.course` -> `courses.code`
  - `forum_replies.thread_id` -> `forum_threads.id`
  - `analytics_snapshots.user_id` -> `users.id`
  - `sessions.user_id` -> `users.id`
- Not-null constraints:
  - most application fields are required
- Default values:
  - common defaults are already defined in SQLite and should be preserved in Postgres
- Cascade behavior:
  - `sessions.user_id` uses `ON DELETE CASCADE` in the dynamic schema
  - the remaining SQLite schema uses `REFERENCES ...` without explicit cascade clauses, so Postgres should be made explicit in the migration design

### Recommended Postgres constraint strategy

- Add explicit `NOT NULL` and `CHECK` constraints where the current code already implies a restricted domain
- Preserve default values for all existing columns
- Use `ON DELETE CASCADE` for dependent child tables where current semantics imply cleanup
- Consider enums for `role`, `status`, and maybe `type`/`difficulty` if they are intended to be limited vocabularies

---

## 7. Index Strategy

Indexes should be added based on current application query patterns, not speculation.

### Current query patterns that imply indexes

- `users.email` should be unique and indexed
- `users.role` and `users.status` may benefit from indexes for admin listing and filtering
- `courses.code` is unique and strongly used as a lookup key
- `notes.course` and `assignments.course` are filtered by course in API endpoints
- `quizzes.course` and `videos.course` are filtered by course
- `study_plan.user_id` and `study_plan.due_date` are used for task list retrieval and ordering
- `forum_threads.course` and `forum_threads.created_at` are used for retrieval and ordering
- `forum_replies.thread_id` and `forum_replies.timestamp` are used for thread replies
- `analytics_snapshots.user_id` is used for per-user retrieval
- `sessions.id_hash` is unique and directly used during every authenticated request
- `sessions.user_id` and `sessions.expires_at` are important for lookup and expiry cleanup

### Recommended index set

- `users(email)` unique
- `users(role)`
- `users(status)`
- `courses(code)` unique
- `notes(course, date)`
- `assignments(course, due_date)`
- `quizzes(course, title)`
- `quiz_questions(quiz_id, order_idx)`
- `flashcards(deck)`
- `videos(course, relevance)`
- `study_plan(user_id, due_date, time)`
- `forum_threads(course, created_at)`
- `forum_replies(thread_id, timestamp)`
- `analytics_snapshots(user_id)`
- `sessions(id_hash)` unique
- `sessions(user_id)`
- `sessions(expires_at)`

---

## 8. JSON / Flexible Data

Several SQLite columns are storing structured data as text values that are parsed by the app. These should become proper Postgres JSONB columns.

### Current JSON/text fields to convert

- `quiz_questions.options`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`
  - current code uses `JSON.parse(qq.options)` in `studyhub-sqlite.ts`

- `forum_threads.tags`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`
  - current code uses `JSON.parse(t.tags)`

- `analytics_snapshots.weekly_progress`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`

- `analytics_snapshots.recent_quiz_scores`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`

- `analytics_snapshots.subject_strengths`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`

- `analytics_snapshots.radar_data`
  - current SQLite: `TEXT` containing JSON array
  - recommended Postgres: `jsonb`

### Type conversion implications

- Existing seed data uses JSON arrays and object arrays, all of which should be valid Postgres JSONB payloads.
- The app currently expects arrays of objects. Postgres `jsonb` preserves that structure.
- Any malformed stored JSON in SQLite will need to be handled carefully during pre-validation.

---

## 9. Migration Risks

This preparation phase identified the following migration risks, which should be addressed during the actual Supabase schema creation and validation phases.

1. SQLite `TEXT` columns are being used for business identifiers, dates, and display strings, which may need explicit type normalization in Postgres.
2. `courses.code` is used as a foreign key target across multiple tables; Postgres must preserve that relationship faithfully.
3. Several existing JSON fields are stored as raw text and may contain malformed JSON in legacy rows.
4. Some current fields such as `last_activity` are relative strings (`"2 hours ago"`) rather than normalized timestamps; those should not be blindly converted.
5. The runtime `sessions` table is not represented in `sqlite-schema.ts`; migration planning must ensure it is included explicitly.
6. `studyhub-sqlite.ts` currently uses a mix of application-generated IDs and business keys (`u1`, `u2`, `cs301`, etc.), so any Postgres schema must decide whether to keep text IDs or switch to UUIDs carefully.
7. SQLite demo seed data includes rows like `status='suspended'`, and those values must match any Postgres check constraints or enums introduced.
8. Several tables currently have no explicit `ON DELETE` behavior beyond SQLite defaults, which could cause orphan records or surprising cascade results during Postgres migration.
9. The app currently expects booleans as `INTEGER` 0/1 in SQLite; Postgres booleans should be introduced cleanly and validated against any code assumptions.
10. Current route handlers directly parse JSON and may assume a specific shape; the migration should verify that raw JSON strings are valid and consistent.
11. Existing timestamp columns are currently stored as `TEXT`; Postgres `timestamptz` would better preserve chronology but requires data conversion and validation.
12. Search patterns rely on `LIKE` queries and course filtering; PostgreSQL index design should align to real usage and not over-index purely speculative columns.

Total migration risks identified: 12

---

## 10. Data Validation Strategy

Before any runtime cutover, the following validation steps should be used to prove the Postgres schema is correct.

### Row-count validation
- Compare row counts for every table between SQLite and Supabase after data load.
- Use a deterministic script or SQL query that reports mismatches by table.

### Primary key validation
- Verify every table has the expected primary key values present.
- Confirm no duplicate primary keys exist in Postgres.

### Foreign key validation
- Verify all foreign keys reference existing rows in parent tables.
- Use Postgres constraints and optional checks to confirm no orphan rows remain.

### Unique constraints validation
- Verify uniqueness for `users.email`, `courses.code`, and `sessions.id_hash`.

### Nullability validation
- Confirm all columns that are marked `NOT NULL` in the schema have no nulls.
- Review columns that were formerly empty strings to ensure intended semantics remain intact.

### Relationship validation
- Check that `study_plan`, `forum_replies`, `analytics_snapshots`, `notes`, `assignments`, `quizzes`, `flashcards`, `videos`, and `sessions` all reference existing base rows.

### JSON validation
- Validate that all JSONB columns contain valid JSON and the expected array/object structures.
- Verify all existing `options`, `tags`, `weekly_progress`, etc. convert cleanly.

### Seed-data validation
- Ensure the seeded demo accounts (`student`, `lecturer`, `admin`) and sample course datasets exist exactly as expected after migration.

---

## 11. Rollback Strategy

This task is a preparation phase only. SQLite remains the live runtime until a later migration phase proves the Postgres schema and data access layer.

### Safe rollback controls

- Do not remove or alter `src/server/db/sqlite-client.ts`, `src/server/db/sqlite-schema.ts`, or `src/server/db/migrate-and-seed.ts` during this preparation phase.
- Keep `DB_PATH` pointed at the existing SQLite database until runtime cutover is explicitly started.
- Preserve the current `studyhubSqlite` router and current session logic until Postgres is fully validated.
- If any migration issue is found, restore the previous SQLite-backed dataset and continue with a corrected schema plan.
- The actual data migration should only proceed once row-count, FK, uniqueness, and JSON validations are green.

---

## 12. Proposed Supabase Project Structure

This section is proposed for the next phases, not created in this preparation step unless needed.

```
supabase/
  config.toml
  migrations/
    001_initial_schema.sql
    002_sessions.sql
    003_seed_data.sql
  seed.sql
```

### Proposed environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWT_SECRET` (only if required by a future edge or server integration)

### Important safety rule

Never place service-role credentials in `VITE_*` variables.

The frontend must not have direct access to privileged Supabase credentials. The Express server should own the database connection boundary.

---

## 13. Data Access Boundary

Before implementation, the cleanest boundary is:

API route -> business logic -> repository/data access -> database

### Boundary recommendation

- `src/server/api/studyhub-sqlite.ts` should remain the HTTP/API layer
- Express should continue handling auth, sessions, authorization, validation, and business rules
- A repository/data-access layer should eventually own all SQL/DB access operations and hide whether the backing store is SQLite or Supabase
- The boundary should be introduced only when there is a clear need and after the schema is validated

### Existing database calls that should eventually move behind the boundary

- all `db.prepare(...)` calls in `src/server/api/studyhub-sqlite.ts`
- session queries in `src/server/auth/session.ts`
- seed operations in `src/server/db/migrate-and-seed.ts`
- any later admin/reporting queries that become part of the application domain

### Boundary principle

Do not create abstractions for the sake of abstraction. Introduce the repository layer only once the target Supabase schema and SQL access patterns are verified.

---

## 14. Supabase Migration Execution Phases

### Phase A — Schema creation
- Objective: create the verified Postgres schema matching the current SQLite model without changing runtime behavior
- Exact files affected:
  - new Postgres migration files under `supabase/migrations/`
  - possibly `supabase/config.toml`
- Files created:
  - `supabase/config.toml`
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/002_sessions.sql`
- Dependencies:
  - completed schema inventory and mapping in this plan
- Risks:
  - type mismatches, default-value differences, missing constraints
- Validation commands:
  - `npm run type-check`
  - `npm test -- --run`
  - `npm run build`
  - plus Supabase schema migration dry-run or apply check
- Acceptance criteria:
  - Postgres schema applies successfully
  - all tables, PKs, FKs, unique constraints, and indexes exist

### Phase B — Database validation
- Objective: verify the newly created Postgres schema against the verified SQLite inventory
- Exact files affected:
  - verification scripts, possibly temporary SQL check scripts
- Files created:
  - validation SQL or scripts used only for verification
- Dependencies:
  - Phase A
- Risks:
  - hidden differences between SQLite and Postgres schema semantics
- Validation commands:
  - schema diff checks
  - row-count comparison
  - FK+unique validation checks
- Acceptance criteria:
  - schema parity is proven before any application cutover

### Phase C — Data migration
- Objective: copy verified application data from SQLite into Supabase
- Exact files affected:
  - migration scripts and data load procedures
- Files created:
  - data migration SQL or scripts
- Dependencies:
  - Phase B
- Risks:
  - malformed JSON, type conversions, duplicate rows, orphan references
- Validation commands:
  - row-count comparison
  - join validation
  - key integrity validation
- Acceptance criteria:
  - all source data is migrated and validated

### Phase D — Supabase data-access implementation
- Objective: introduce the repository/data-access boundary for Supabase-backed reads/writes while leaving SQLite active
- Exact files affected:
  - new repository layer files
  - optional server-side adapters
- Files created:
  - repository/data-access modules
- Dependencies:
  - Phase C
- Risks:
  - accidental runtime behavior drift when swapping storage backends
- Validation commands:
  - `npm run type-check`
  - `npm test -- --run`
  - `npm run build`
- Acceptance criteria:
  - data-access layer is abstracted cleanly
  - SQLite remains available and no app behavior changes yet

### Phase E — Runtime cutover
- Objective: switch the app from SQLite to Supabase for persistent relational data while keeping the current auth/session architecture intact
- Exact files affected:
  - server data access wiring
  - environment configuration
- Files created:
  - updated environment template files if needed
- Dependencies:
  - Phase D
- Risks:
  - unexpected data contract differences, query regressions, connection errors
- Validation commands:
  - `npm run type-check`
  - `npm test -- --run`
  - `npm run build`
  - targeted runtime smoke tests against live Postgres
- Acceptance criteria:
  - app runs against Supabase with no auth/session changes

### Phase F — Session migration verification
- Objective: prove that the existing server-side session model still works under Supabase-backed persistence
- Exact files affected:
  - session-handling verification scripts/tests
- Files created:
  - session-focused tests or verification scripts
- Dependencies:
  - Phase E
- Risks:
  - session lookup failures, expiry edge cases, role resolution regressions
- Validation commands:
  - auth regression suite
  - route-level protected-route tests
- Acceptance criteria:
  - login, logout, role gating, and expiry continue to work

### Phase G — Full regression
- Objective: verify the complete app after the database change
- Exact files affected:
  - tests and regression documentation
- Files created:
  - additional regression tests as needed
- Dependencies:
  - Phase F
- Risks:
  - backend query drift, UI assumptions, route contract changes
- Validation commands:
  - `npm run type-check`
  - `npm test -- --run`
  - `npm run build`
- Acceptance criteria:
  - full repository validation remains green

### Phase H — SQLite retirement
- Objective: remove SQLite only after Postgres is fully validated and proven in production-like conditions
- Exact files affected:
  - runtime wiring, docs, cleanup scripts
- Files created:
  - deprecation or retirement notes
- Dependencies:
  - Phase G
- Risks:
  - hidden operational dependencies on SQLite, stale code paths
- Validation commands:
  - `npm run type-check`
  - `npm test -- --run`
  - `npm run build`
- Acceptance criteria:
  - SQLite is no longer used by the app, and the repo is fully migrated to Supabase PostgreSQL

---

## 15. Next Implementation Prompt

Create and validate the Supabase PostgreSQL schema from the verified SQLite schema.

Context:
- Project root: `D:\PROJECTS\StudyHub_AI\StudyHub_AI`
- Current baseline is green before Supabase migration:
  - `npm run type-check` ✅
  - `npm run lint` ✅
  - `npm test -- --run` ✅
  - `npm run build` ✅
- Existing Express auth/session architecture is already working and must remain unchanged.
- SQLite is the current canonical runtime database and must remain untouched during this phase.
- Supabase is not connected yet.

Requirements:
1. Inspect the verified SQLite schema in:
   - `src/server/db/sqlite-schema.ts`
   - `src/server/db/sqlite-client.ts`
   - `src/server/db/migrate-and-seed.ts`
   - `src/server/auth/session.ts`
   - `src/server/api/studyhub-sqlite.ts`
2. Create the Supabase PostgreSQL schema that matches the verified SQLite schema, including:
   - all tables
   - PKs
   - FKs
   - unique constraints
   - indexes
   - defaults
   - JSONB conversion for flexible data fields
   - session table support without introducing Supabase Auth
3. Preserve the current Express responsibilities:
   - authentication
   - session verification
   - authorization
   - validation
   - business logic
   - API contracts
4. Do not:
   - connect the app to Supabase yet
   - migrate production data yet
   - remove or replace SQLite yet
   - change frontend behavior
   - change auth architecture
   - introduce Supabase Auth
   - refactor unrelated code
5. Add all required schema artifacts under `supabase/` only as needed for the first implementation phase.
6. Validate the created schema with the existing repository commands after the schema artifacts are added.
7. Keep the current green baseline intact.

Deliverables:
- Postgres schema artifacts under `supabase/`
- schema validation evidence
- any required environment variable documentation for the next phase

---

## 16. File Safety Preserved During Preparation

This preparation phase intentionally did not:
- delete or deprecate SQLite database files
- delete or deprecate `sqlite-client.ts`
- delete or deprecate `sqlite-schema.ts`
- delete or deprecate `migrate-and-seed.ts`
- modify application runtime code beyond the creation of this plan document

---

## 17. Summary

The repository currently contains:
- 12 application tables in the SQLite schema
- 1 runtime-created session table in `src/server/auth/session.ts`
- 12 identified migration risks
- clear one-to-many relationship patterns
- a server-enforced session architecture that should be preserved

The plan therefore supports the correct next sequence:

Green application -> Supabase schema plan -> Postgres schema creation -> validation -> data migration -> data-access implementation -> runtime cutover -> full regression -> SQLite retirement

This preserves the verified baseline and avoids changing the database, auth model, or frontend behavior prematurely.
