-- Additive Tutor/content foundation plus Phase 4 text version, job, and chunk tables.
-- No file bytes, object storage, embeddings, or existing-row backfill.

CREATE TABLE IF NOT EXISTS course_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS learning_resources (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'document',
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    visibility TEXT NOT NULL DEFAULT 'course',
    status TEXT NOT NULL DEFAULT 'draft',
    current_version_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS content_versions (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    checksum TEXT,
    mime_type TEXT,
    byte_size BIGINT,
    storage_reference TEXT,
    extraction_status TEXT NOT NULL DEFAULT 'not_started',
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    UNIQUE (resource_id, version_number)
);

CREATE TABLE IF NOT EXISTS content_processing_jobs (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'text_extraction',
    status TEXT NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_chunks (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    page_number INTEGER DEFAULT 1,
    heading_path TEXT NOT NULL DEFAULT '',
    char_start INTEGER DEFAULT 0,
    char_end INTEGER DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_id, ordinal)
);

ALTER TABLE learning_resources
  DROP CONSTRAINT IF EXISTS learning_resources_current_version_id_fkey;
ALTER TABLE learning_resources
  ADD CONSTRAINT learning_resources_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES content_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tutor_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    topic TEXT,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tutor_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES tutor_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mode TEXT,
    grounding_status TEXT,
    UNIQUE (conversation_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_course_memberships_user_status ON course_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_course_memberships_course_status ON course_memberships(course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_resources_course_status ON learning_resources(course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_resources_creator ON learning_resources(created_by);
CREATE INDEX IF NOT EXISTS idx_content_versions_resource_version ON content_versions(resource_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_content_processing_jobs_version ON content_processing_jobs(version_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_version_ordinal ON content_chunks(version_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_user_updated ON tutor_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_conversation_sequence ON tutor_messages(conversation_id, sequence);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, owner_id, type)
VALUES (
  'studyhub-private',
  'studyhub-private',
  false,
  104857600,
  ARRAY[
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  NULL,
  'STANDARD'
)
ON CONFLICT (name)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  owner_id = EXCLUDED.owner_id,
  type = EXCLUDED.type;
