-- StudyHub AI initial Supabase/Postgres schema
-- This migration reproduces the verified SQLite application model without changing
-- the current SQLite runtime database or Express auth/session behavior.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    avatar TEXT NOT NULL DEFAULT '',
    program TEXT DEFAULT '',
    year INTEGER DEFAULT 1,
    department TEXT DEFAULT '',
    streak INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    joined DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#1F6F6B',
    progress INTEGER NOT NULL DEFAULT 0,
    notes_count INTEGER NOT NULL DEFAULT 0,
    assignments_count INTEGER NOT NULL DEFAULT 0,
    icon TEXT NOT NULL DEFAULT 'BookOpen',
    lecturer TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    course TEXT NOT NULL REFERENCES courses(code),
    type TEXT NOT NULL DEFAULT 'pdf',
    date DATE NOT NULL,
    size TEXT NOT NULL DEFAULT '',
    pages INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    course TEXT NOT NULL REFERENCES courses(code),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    grade NUMERIC,
    max_grade NUMERIC NOT NULL DEFAULT 100,
    weight TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    course TEXT NOT NULL REFERENCES courses(code),
    difficulty TEXT NOT NULL DEFAULT 'Medium',
    question_count INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 10,
    best_score NUMERIC,
    ai_generated BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id),
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    order_idx INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    deck TEXT NOT NULL REFERENCES courses(code),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ai_generated BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    thumbnail TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    views TEXT NOT NULL DEFAULT '',
    relevance INTEGER NOT NULL DEFAULT 90,
    course TEXT NOT NULL REFERENCES courses(code),
    uploaded_ago TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS study_plan (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    course TEXT NOT NULL REFERENCES courses(code),
    due_date DATE NOT NULL,
    time TEXT NOT NULL DEFAULT '09:00',
    duration INTEGER NOT NULL DEFAULT 60,
    type TEXT NOT NULL DEFAULT 'study',
    completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS forum_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    course TEXT NOT NULL REFERENCES courses(code),
    author TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'student',
    views INTEGER NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    solved BOOLEAN NOT NULL DEFAULT FALSE,
    last_activity TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES forum_threads(id),
    author TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'student',
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    overall_grade NUMERIC NOT NULL DEFAULT 0,
    quiz_average NUMERIC NOT NULL DEFAULT 0,
    study_hours INTEGER NOT NULL DEFAULT 0,
    assignments_done INTEGER NOT NULL DEFAULT 0,
    assignments_total INTEGER NOT NULL DEFAULT 0,
    day_streak INTEGER NOT NULL DEFAULT 0,
    courses_active INTEGER NOT NULL DEFAULT 0,
    weekly_progress JSONB NOT NULL DEFAULT '[]'::jsonb,
    recent_quiz_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    radar_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    id_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_notes_course ON notes(course);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course);
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id_order ON quiz_questions(quiz_id, order_idx);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck);
CREATE INDEX IF NOT EXISTS idx_videos_course_relevance ON videos(course, relevance);
CREATE INDEX IF NOT EXISTS idx_study_plan_user_due ON study_plan(user_id, due_date, time);
CREATE INDEX IF NOT EXISTS idx_forum_threads_course_created ON forum_threads(course, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread_timestamp ON forum_replies(thread_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user ON analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
