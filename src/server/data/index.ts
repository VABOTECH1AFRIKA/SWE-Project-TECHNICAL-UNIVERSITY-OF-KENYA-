import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'sqlite' | 'supabase';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'lecturer' | 'admin';
  avatar: string;
  program?: string;
  year?: number;
  department?: string;
  streak?: number;
  status?: string;
};

function mapUser(row: any, includePasswordHash = false): any {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    program: row.program ?? undefined,
    year: row.year ?? undefined,
    department: row.department ?? undefined,
    streak: row.streak ?? undefined,
    status: row.status ?? undefined,
    ...(row.joined !== undefined ? { joined: row.joined } : {}),
    ...(includePasswordHash && row.password_hash !== undefined ? { password_hash: row.password_hash } : {}),
  };
}

function mapCourse(row: any): any {
  return row
    ? {
        id: row.id,
        code: row.code,
        title: row.title,
        color: row.color,
        progress: row.progress,
        notesCount: row.notes_count ?? row.notesCount,
        assignmentsCount: row.assignments_count ?? row.assignmentsCount,
        icon: row.icon,
        lecturer: row.lecturer,
      }
    : null;
}

function mapAssignment(row: any): any {
  return row
    ? {
        id: row.id,
        title: row.title,
        course: row.course,
        dueDate: row.due_date ?? row.dueDate,
        status: row.status,
        grade: row.grade,
        maxGrade: row.max_grade ?? row.maxGrade,
        weight: row.weight,
      }
    : null;
}

function mapQuizQuestion(row: any): any {
  return row
    ? {
        id: row.id,
        question: row.question,
        options: Array.isArray(row.options) ? row.options : JSON.parse(row.options ?? '[]'),
        correct: row.correct,
        explanation: row.explanation,
      }
    : null;
}

function mapQuiz(row: any): any {
  return row
    ? {
        id: row.id,
        title: row.title,
        course: row.course,
        difficulty: row.difficulty,
        questionCount: row.question_count ?? row.questionCount,
        duration: row.duration,
        bestScore: row.best_score ?? row.bestScore ?? null,
        aiGenerated: Boolean(row.ai_generated ?? row.aiGenerated),
        questions: (row.questions ?? []).map(mapQuizQuestion),
      }
    : null;
}

function mapFlashcard(row: any): any {
  return row
    ? {
        id: row.id,
        deck: row.deck,
        front: row.front,
        back: row.back,
        aiGenerated: Boolean(row.ai_generated ?? row.aiGenerated),
      }
    : null;
}

function mapVideo(row: any): any {
  return row
    ? {
        id: row.id,
        title: row.title,
        channel: row.channel,
        thumbnail: row.thumbnail,
        duration: row.duration,
        views: row.views,
        relevance: row.relevance,
        course: row.course,
        uploadedAgo: row.uploaded_ago ?? row.uploadedAgo,
      }
    : null;
}

function mapStudyPlanItem(row: any): any {
  return row
    ? {
        id: row.id,
        userId: row.user_id ?? row.userId,
        title: row.title,
        course: row.course,
        dueDate: row.due_date ?? row.dueDate,
        time: row.time,
        duration: row.duration,
        type: row.type,
        completed: Boolean(row.completed),
      }
    : null;
}

function normalizeTextContent(content: string): string {
  return String(content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^\s*#{1,6}\s+.*(?:\n|$)/gm, '')
    .trim();
}

function normalizeChunkText(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildContentChunks(content: string, sections: Array<{ text: string; pageNumber?: number; slideNumber?: number; headingPath?: string }> = []): Array<{ id: string; ordinal: number; text: string; tokenCount: number; pageNumber: number; headingPath: string; charStart: number; charEnd: number; metadata: Record<string, unknown> }> {
  const normalized = normalizeTextContent(content);
  if (!normalized) {
    return [];
  }

  const segments: string[] = normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const chunks: Array<{ id: string; ordinal: number; text: string; tokenCount: number; pageNumber: number; headingPath: string; charStart: number; charEnd: number; metadata: Record<string, unknown> }> = [];

  let cursor = 0;
  segments.forEach((segment, index) => {
    const segmentText = segment.replace(/\s+/g, ' ').trim();
    if (!segmentText) return;

    const chunkText = segmentText.length > 1200 ? segmentText.match(/.{1,1200}(?=\s|$)|.{1,1200}/g)?.filter(Boolean) ?? [segmentText] : [segmentText];

    chunkText.forEach((textPart, partIndex) => {
      const trimmed = normalizeChunkText(textPart.trim());
      if (!trimmed) return;

      const start = normalized.indexOf(trimmed, cursor);
      const end = start >= 0 ? start + trimmed.length : cursor;
      const sourceSection = sections.find((section) => section.text.includes(textPart.trim())) ?? sections[index];
      const sourceMetadata = {
        source: 'text',
        sectionIndex: index,
        partIndex,
        ...(sourceSection?.pageNumber !== undefined ? { pageNumber: sourceSection.pageNumber } : {}),
        ...(sourceSection?.slideNumber !== undefined ? { slideNumber: sourceSection.slideNumber } : {}),
      };

      chunks.push({
        id: `cc${randomUUID().slice(0, 8)}`,
        ordinal: chunks.length + 1,
        text: trimmed,
        tokenCount: Math.max(1, Math.ceil(trimmed.split(/\s+/).filter(Boolean).length)),
        pageNumber: sourceSection?.pageNumber ?? 1,
        headingPath: sourceSection?.headingPath ?? `section-${index + 1}`,
        charStart: start >= 0 ? start : cursor,
        charEnd: end,
        metadata: sourceMetadata,
      });

      cursor = end;
    });
  });

  return chunks.length > 0 ? chunks : [{
    id: `cc${randomUUID().slice(0, 8)}`,
    ordinal: 1,
    text: normalizeChunkText(normalized),
    tokenCount: Math.max(1, Math.ceil(normalized.split(/\s+/).filter(Boolean).length)),
    pageNumber: 1,
    headingPath: 'section-1',
    charStart: 0,
    charEnd: normalized.length,
    metadata: { source: 'text', sectionIndex: 0, partIndex: 0 },
  }];
}

function getDbPath(): string {
  return process.env.DB_PATH || path.join('/private', 'studyhub.db');
}

let supabaseClient: SupabaseClient | null | undefined;

function getSqliteDb() {
  const db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function ensureSqliteSessionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      id_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    supabaseClient = null;
    return null;
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

function resolveProvider(): DataProvider {
  const configured = process.env.DATABASE_PROVIDER?.trim().toLowerCase();

  if (!configured) {
    return 'sqlite';
  }

  if (configured === 'sqlite' || configured === 'supabase') {
    return configured;
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${configured}. Expected "sqlite" or "supabase".`);
}

const sqliteRepository: any = {
  users: {
    list: () => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users ORDER BY joined DESC').all());
      } finally {
        db.close();
      }
    },
    getById: (id: string) => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(
          db.prepare('SELECT id,name,email,role,avatar,program,year,department,streak,status FROM users WHERE id=?').get(id),
        );
      } finally {
        db.close();
      }
    },
    getByEmail: (email: string) => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(db.prepare('SELECT * FROM users WHERE email=?').get(email));
      } finally {
        db.close();
      }
    },
    create: (input: Record<string, unknown>) => {
      const db = getSqliteDb();
      try {
        const id = `u${randomUUID().slice(0, 8)}`;
        db.prepare(
          'INSERT INTO users (id,name,email,password_hash,role,avatar,program,year,department,streak,status,joined) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        ).run(
          id,
          input.name,
          input.email,
          input.passwordHash,
          input.role || 'student',
          input.avatar || '',
          input.program || '',
          input.year || 1,
          input.department || '',
          input.streak || 0,
          input.status || 'active',
          input.joined || new Date().toISOString().split('T')[0],
        );

        return Promise.resolve(db.prepare('SELECT id,name,email,role,avatar,program,year,department,streak,status FROM users WHERE id=?').get(id));
      } finally {
        db.close();
      }
    },
    updateStatus: (id: string, status: 'active' | 'suspended') => {
      const db = getSqliteDb();
      try {
        db.prepare('UPDATE users SET status=? WHERE id=?').run(status, id);
        return Promise.resolve(db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users WHERE id=?').get(id));
      } finally {
        db.close();
      }
    },
  },
  contentIngestion: {
    createProcessingIntent: (payload: { resourceId: string; mimeType: string; byteSize: number; checksum: string; createdBy: string }) => {
      const db = getSqliteDb();
      try {
        const resource = db.prepare('SELECT id FROM learning_resources WHERE id = ?').get(payload.resourceId);
        if (!resource) return Promise.resolve(null);
        const duplicate: any = db.prepare("SELECT v.id AS version_id, j.id AS job_id, v.version_number FROM content_versions v JOIN content_processing_jobs j ON j.version_id = v.id WHERE v.resource_id = ? AND v.checksum = ? ORDER BY v.version_number DESC LIMIT 1").get(payload.resourceId, payload.checksum);
        if (duplicate) return Promise.resolve({ versionId: duplicate.version_id, jobId: duplicate.job_id, versionNumber: duplicate.version_number, duplicate: true });
        const versionSummary = db.prepare('SELECT COALESCE(MAX(version_number), 0) AS max_version FROM content_versions WHERE resource_id = ?').get(payload.resourceId) as { max_version: number | null };
        const versionId = `cv${randomUUID().slice(0, 8)}`;
        const jobId = `cj${randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();
        db.transaction(() => {
          db.prepare(`INSERT INTO content_versions (id, resource_id, version_number, checksum, mime_type, byte_size, storage_reference, extraction_status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'queued', ?, ?)`).run(
            versionId,
            payload.resourceId,
            Number(versionSummary.max_version ?? 0) + 1,
            payload.checksum,
            payload.mimeType,
            payload.byteSize,
            payload.createdBy,
            now,
          );
          db.prepare(`INSERT INTO content_processing_jobs (id, version_id, job_type, status, attempt_count, created_at, updated_at) VALUES (?, ?, 'text_extraction', 'queued', 0, ?, ?)`).run(jobId, versionId, now, now);
        })();
        return Promise.resolve({ versionId, jobId, versionNumber: Number(versionSummary.max_version ?? 0) + 1 });
      } finally {
        db.close();
      }
    },
    setVersionStorageReference: (versionId: string, storageReference: string) => {
      const db = getSqliteDb();
      try {
        db.prepare('UPDATE content_versions SET storage_reference = ? WHERE id = ?').run(storageReference, versionId);
        return Promise.resolve();
      } finally {
        db.close();
      }
    },
    startProcessing: (versionId: string) => {
      const db = getSqliteDb();
      try {
        const now = new Date().toISOString();
        const result = db.prepare(`UPDATE content_processing_jobs SET status = 'processing', attempt_count = attempt_count + 1, started_at = ?, updated_at = ? WHERE version_id = ? AND status = 'queued'`).run(now, now, versionId);
        if (result.changes !== 1) throw new Error('Invalid processing transition');
        db.prepare(`UPDATE content_versions SET extraction_status = 'processing' WHERE id = ?`).run(versionId);
        return Promise.resolve();
      } finally {
        db.close();
      }
    },
    completeProcessing: (payload: { versionId: string; text: string; sections: Array<{ text: string; pageNumber?: number; slideNumber?: number; headingPath?: string }> }) => {
      const db = getSqliteDb();
      try {
        const now = new Date().toISOString();
        const version: any = db.prepare('SELECT * FROM content_versions WHERE id = ?').get(payload.versionId);
        if (!version) return Promise.resolve(null);
        const job: any = db.prepare("SELECT * FROM content_processing_jobs WHERE version_id = ? AND status = 'processing'").get(payload.versionId);
        if (!job) throw new Error('Invalid processing transition');
        const chunks = buildContentChunks(payload.text, payload.sections);
        db.transaction(() => {
          chunks.forEach((chunk) => db.prepare(`INSERT INTO content_chunks (id, version_id, ordinal, text, token_count, page_number, heading_path, char_start, char_end, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            chunk.id, payload.versionId, chunk.ordinal, chunk.text, chunk.tokenCount, chunk.pageNumber, chunk.headingPath, chunk.charStart, chunk.charEnd, JSON.stringify(chunk.metadata), now,
          ));
          db.prepare("UPDATE content_processing_jobs SET status = 'completed', finished_at = ?, last_error = NULL, updated_at = ? WHERE id = ? AND status = 'processing'").run(now, now, job.id);
          db.prepare("UPDATE content_versions SET extraction_status = 'completed' WHERE id = ?").run(payload.versionId);
          db.prepare('UPDATE learning_resources SET current_version_id = ?, updated_at = ? WHERE id = ?').run(payload.versionId, now, version.resource_id);
        })();
        return Promise.resolve({ versionId: payload.versionId, status: 'completed', chunks: chunks.length });
      } finally {
        db.close();
      }
    },
    failProcessing: (versionId: string, errorMessage: string) => {
      const db = getSqliteDb();
      try {
        const now = new Date().toISOString();
        db.transaction(() => {
          db.prepare("UPDATE content_processing_jobs SET status = 'failed', last_error = ?, finished_at = ?, updated_at = ? WHERE version_id = ? AND status IN ('queued', 'processing')").run(errorMessage.slice(0, 1000), now, now, versionId);
          db.prepare("UPDATE content_versions SET extraction_status = 'failed' WHERE id = ?").run(versionId);
        })();
        return Promise.resolve();
      } finally {
        db.close();
      }
    },
    getProcessing: (resourceId: string) => {
      const db = getSqliteDb();
      try {
        const row: any = db.prepare(`SELECT v.*, j.id AS job_id, j.job_type, j.status AS job_status, j.attempt_count, j.last_error, j.started_at, j.finished_at, j.next_attempt_at, j.created_at AS job_created_at, j.updated_at AS job_updated_at FROM content_versions v JOIN content_processing_jobs j ON j.version_id = v.id WHERE v.resource_id = ? ORDER BY v.version_number DESC LIMIT 1`).get(resourceId);
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          version: { id: row.id, resourceId: row.resource_id, versionNumber: row.version_number, checksum: row.checksum, mimeType: row.mime_type, byteSize: row.byte_size, storageReference: row.storage_reference, extractionStatus: row.extraction_status, createdBy: row.created_by, createdAt: row.created_at, supersededAt: row.superseded_at, publishedAt: row.published_at },
          processingJob: { id: row.job_id, versionId: row.id, jobType: row.job_type, status: row.job_status, attemptCount: row.attempt_count, lastError: row.last_error, startedAt: row.started_at, finishedAt: row.finished_at, nextAttemptAt: row.next_attempt_at, createdAt: row.job_created_at, updatedAt: row.job_updated_at },
        });
      } finally {
        db.close();
      }
    },
    getVersionSource: (resourceId: string) => {
      const db = getSqliteDb();
      try {
        const row: any = db.prepare("SELECT id, storage_reference, mime_type FROM content_versions WHERE resource_id = ? AND storage_reference IS NOT NULL ORDER BY version_number DESC LIMIT 1").get(resourceId);
        return Promise.resolve(row ? { versionId: row.id, storageReference: row.storage_reference, mimeType: row.mime_type } : null);
      } finally {
        db.close();
      }
    },
    beginRetry: (resourceId: string) => {
      const db = getSqliteDb();
      try {
        const now = new Date().toISOString();
        const row: any = db.prepare("SELECT v.id, v.storage_reference, v.mime_type, j.id AS job_id FROM content_versions v JOIN content_processing_jobs j ON j.version_id = v.id WHERE v.resource_id = ? AND j.status = 'failed' ORDER BY v.version_number DESC LIMIT 1").get(resourceId);
        if (!row || !row.storage_reference) return Promise.resolve(null);
        const result = db.prepare("UPDATE content_processing_jobs SET status = 'processing', attempt_count = attempt_count + 1, last_error = NULL, started_at = ?, finished_at = NULL, updated_at = ? WHERE id = ? AND status = 'failed'").run(now, now, row.job_id);
        if (result.changes !== 1) return Promise.resolve(null);
        db.prepare("UPDATE content_versions SET extraction_status = 'processing' WHERE id = ?").run(row.id);
        return Promise.resolve({ versionId: row.id, storageReference: row.storage_reference, mimeType: row.mime_type });
      } finally {
        db.close();
      }
    },
  },
  courses: {
    list: () => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(
          db
            .prepare(
              'SELECT id,code,title,color,progress,notes_count as notesCount,assignments_count as assignmentsCount,icon,lecturer FROM courses ORDER BY code',
            )
            .all(),
        );
      } finally {
        db.close();
      }
    },
    getByIdOrCode: (idOrCode: string) => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(
          db
            .prepare(
              'SELECT id,code,title,color,progress,notes_count as notesCount,assignments_count as assignmentsCount,icon,lecturer FROM courses WHERE id=? OR code=?',
            )
            .get(idOrCode, idOrCode),
        );
      } finally {
        db.close();
      }
    },
  },
  courseMemberships: {
    listForUser: (userId: string) => {
      const db = getSqliteDb();
      try {
        return Promise.resolve(
          db.prepare('SELECT * FROM course_memberships WHERE user_id=? AND status=? ORDER BY created_at DESC').all(userId, 'active'),
        );
      } finally {
        db.close();
      }
    },
    isUserAuthorizedForCourse: (userId: string, courseId: string, role?: 'student' | 'lecturer' | 'admin') => {
      const db = getSqliteDb();
      try {
        const allowedRoles = role === 'lecturer' ? ['lecturer', 'admin'] : ['student', 'lecturer', 'admin'];
        const placeholders = allowedRoles.map(() => '?').join(', ');
        const sql = `SELECT 1 FROM course_memberships WHERE user_id=? AND course_id=? AND status=? AND role IN (${placeholders})`;
        const params = [userId, courseId, 'active', ...allowedRoles];
        const row = db.prepare(sql).get(...params);
        return Promise.resolve(Boolean(row));
      } finally {
        db.close();
      }
    },
  },
  learningResources: {
    list: (courseId?: string) => {
      const db = getSqliteDb();
      try {
        const rows = courseId
          ? db
              .prepare(
                `SELECT lr.*, c.code AS course_code, c.title AS course_title, u.name AS owner_name
                 FROM learning_resources lr
                 LEFT JOIN courses c ON c.id = lr.course_id
                 LEFT JOIN users u ON u.id = lr.owner_user_id
                 WHERE lr.course_id = ?
                 ORDER BY lr.updated_at DESC`,
              )
              .all(courseId)
          : db
              .prepare(
                `SELECT lr.*, c.code AS course_code, c.title AS course_title, u.name AS owner_name
                 FROM learning_resources lr
                 LEFT JOIN courses c ON c.id = lr.course_id
                 LEFT JOIN users u ON u.id = lr.owner_user_id
                 ORDER BY lr.updated_at DESC`,
              )
              .all();

        return Promise.resolve(
          rows.map((row: any) => ({
            id: row.id,
            courseId: row.course_id,
            courseCode: row.course_code,
            courseTitle: row.course_title,
            title: row.title,
            resourceType: row.resource_type,
            ownerUserId: row.owner_user_id,
            ownerName: row.owner_name,
            createdBy: row.created_by,
            visibility: row.visibility,
            status: row.status,
            currentVersionId: row.current_version_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            publishedAt: row.published_at,
          })),
        );
      } finally {
        db.close();
      }
    },
    getById: (id: string) => {
      const db = getSqliteDb();
      try {
        const row: any = db
          .prepare(
            `SELECT lr.*, c.code AS course_code, c.title AS course_title, u.name AS owner_name
             FROM learning_resources lr
             LEFT JOIN courses c ON c.id = lr.course_id
             LEFT JOIN users u ON u.id = lr.owner_user_id
             WHERE lr.id = ?`,
          )
          .get(id);

        if (!row) return Promise.resolve(null);

        return Promise.resolve({
          id: row.id,
          courseId: row.course_id,
          courseCode: row.course_code,
          courseTitle: row.course_title,
          title: row.title,
          resourceType: row.resource_type,
          ownerUserId: row.owner_user_id,
          ownerName: row.owner_name,
          createdBy: row.created_by,
          visibility: row.visibility,
          status: row.status,
          currentVersionId: row.current_version_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          publishedAt: row.published_at,
        });
      } finally {
        db.close();
      }
    },
    create: (payload: {
      courseId: string;
      title: string;
      resourceType?: string;
      ownerUserId?: string | null;
      createdBy: string;
      visibility?: string;
      status?: string;
      currentVersionId?: string | null;
    }) => {
      const db = getSqliteDb();
      try {
        const id = `lr${randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO learning_resources
            (id, course_id, title, resource_type, owner_user_id, created_by, visibility, status, current_version_id, created_at, updated_at, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          payload.courseId,
          payload.title,
          payload.resourceType || 'document',
          payload.ownerUserId ?? null,
          payload.createdBy,
          payload.visibility || 'course',
          payload.status || 'draft',
          payload.currentVersionId ?? null,
          now,
          now,
          null,
        );

        const createdRow: any = db.prepare(
          `SELECT lr.*, c.code AS course_code, c.title AS course_title, u.name AS owner_name
           FROM learning_resources lr
           LEFT JOIN courses c ON c.id = lr.course_id
           LEFT JOIN users u ON u.id = lr.owner_user_id
           WHERE lr.id = ?`,
        ).get(id);

        return Promise.resolve(
          createdRow
            ? {
                id: createdRow.id,
                courseId: createdRow.course_id,
                courseCode: createdRow.course_code,
                courseTitle: createdRow.course_title,
                title: createdRow.title,
                resourceType: createdRow.resource_type,
                ownerUserId: createdRow.owner_user_id,
                ownerName: createdRow.owner_name,
                createdBy: createdRow.created_by,
                visibility: createdRow.visibility,
                status: createdRow.status,
                currentVersionId: createdRow.current_version_id,
                createdAt: createdRow.created_at,
                updatedAt: createdRow.updated_at,
                publishedAt: createdRow.published_at,
              }
            : null,
        );
      } finally {
        db.close();
      }
    },
    update: (
      id: string,
      patch: Partial<{ title: string; courseId: string; resourceType: string; ownerUserId: string | null; visibility: string; status: string; currentVersionId: string | null }>,
    ) => {
      const db = getSqliteDb();
      try {
        const existing: any = db.prepare('SELECT * FROM learning_resources WHERE id=?').get(id);
        if (!existing) return Promise.resolve(null);

        const values = {
          title: patch.title ?? existing.title,
          course_id: patch.courseId ?? existing.course_id,
          resource_type: patch.resourceType ?? existing.resource_type,
          owner_user_id: patch.ownerUserId ?? existing.owner_user_id,
          visibility: patch.visibility ?? existing.visibility,
          status: patch.status ?? existing.status,
          current_version_id: patch.currentVersionId ?? existing.current_version_id,
        };

        const nextUpdatedAt = new Date().toISOString();
        db.prepare(
          `UPDATE learning_resources
           SET title = ?, course_id = ?, resource_type = ?, owner_user_id = ?, visibility = ?, status = ?, current_version_id = ?, updated_at = ?, published_at = COALESCE(published_at, ?)
           WHERE id = ?`,
        ).run(
          values.title,
          values.course_id,
          values.resource_type,
          values.owner_user_id,
          values.visibility,
          values.status,
          values.current_version_id,
          nextUpdatedAt,
          patch.status === 'published' ? nextUpdatedAt : null,
          id,
        );

        const row: any = db.prepare('SELECT * FROM learning_resources WHERE id=?').get(id);
        if (!row) return Promise.resolve(null);

        return Promise.resolve({
          id: row.id,
          courseId: row.course_id,
          title: row.title,
          resourceType: row.resource_type,
          ownerUserId: row.owner_user_id,
          createdBy: row.created_by,
          visibility: row.visibility,
          status: row.status,
          currentVersionId: row.current_version_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          publishedAt: row.published_at,
        });
      } finally {
        db.close();
      }
    },
    listVersions: (resourceId: string) => {
      const db = getSqliteDb();
      try {
        const rows = db
          .prepare(
            `SELECT * FROM content_versions WHERE resource_id = ? ORDER BY version_number DESC, created_at DESC`,
          )
          .all(resourceId) as any[];

        return Promise.resolve(
          rows.map((row) => ({
            id: row.id,
            resourceId: row.resource_id,
            versionNumber: row.version_number,
            checksum: row.checksum,
            mimeType: row.mime_type,
            byteSize: row.byte_size,
            storageReference: row.storage_reference,
            extractionStatus: row.extraction_status,
            createdBy: row.created_by,
            createdAt: row.created_at,
            supersededAt: row.superseded_at,
            publishedAt: row.published_at,
          })),
        );
      } finally {
        db.close();
      }
    },
    ingestTextContent: (payload: { resourceId: string; mimeType?: string; content: string; createdBy: string }) => {
      const db = getSqliteDb();
      try {
        const resource = db.prepare('SELECT * FROM learning_resources WHERE id = ?').get(payload.resourceId) as any;
        if (!resource) return Promise.resolve(null);

        const text = normalizeTextContent(payload.content);
        if (!text) return Promise.resolve(null);

        const versionSummary = db
          .prepare('SELECT COALESCE(MAX(version_number), 0) AS max_version FROM content_versions WHERE resource_id = ?')
          .get(payload.resourceId) as { max_version: number | null } | undefined;
        const nextVersionNumber = Number(versionSummary?.max_version ?? 0) + 1;
        const versionId = `cv${randomUUID().slice(0, 8)}`;
        const jobId = `cj${randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();
        const checksum = createHash('sha256').update(text).digest('hex');
        const byteSize = Buffer.byteLength(text, 'utf8');

        db.transaction(() => {
          db.prepare(
            `INSERT INTO content_versions (id, resource_id, version_number, checksum, mime_type, byte_size, storage_reference, extraction_status, created_by, created_at, superseded_at, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            versionId,
            payload.resourceId,
            nextVersionNumber,
            checksum,
            payload.mimeType || 'text/plain',
            byteSize,
            null,
            'completed',
            payload.createdBy,
            now,
            null,
            null,
          );

          db.prepare(
            `INSERT INTO content_processing_jobs (id, version_id, job_type, status, attempt_count, last_error, started_at, finished_at, next_attempt_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            jobId,
            versionId,
            'text_extraction',
            'completed',
            1,
            null,
            now,
            now,
            null,
            now,
            now,
          );

          const chunks = buildContentChunks(text);
          chunks.forEach((chunk) => {
            db.prepare(
              `INSERT INTO content_chunks (id, version_id, ordinal, text, token_count, page_number, heading_path, char_start, char_end, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              chunk.id,
              versionId,
              chunk.ordinal,
              chunk.text,
              chunk.tokenCount,
              chunk.pageNumber,
              chunk.headingPath,
              chunk.charStart,
              chunk.charEnd,
              JSON.stringify(chunk.metadata),
              now,
            );
          });

          db.prepare(
            `UPDATE learning_resources SET current_version_id = ?, updated_at = ?, published_at = COALESCE(published_at, ?) WHERE id = ?`,
          ).run(versionId, now, resource.status === 'published' ? now : null, payload.resourceId);
        })();

        const versionRow: any = db.prepare('SELECT * FROM content_versions WHERE id = ?').get(versionId);
        const jobRow: any = db.prepare('SELECT * FROM content_processing_jobs WHERE id = ?').get(jobId);
        const chunkRows: any[] = db.prepare('SELECT * FROM content_chunks WHERE version_id = ? ORDER BY ordinal ASC').all(versionId);

        return Promise.resolve({
          version: {
            id: versionRow.id,
            resourceId: versionRow.resource_id,
            versionNumber: versionRow.version_number,
            checksum: versionRow.checksum,
            mimeType: versionRow.mime_type,
            byteSize: versionRow.byte_size,
            storageReference: versionRow.storage_reference,
            extractionStatus: versionRow.extraction_status,
            createdBy: versionRow.created_by,
            createdAt: versionRow.created_at,
            supersededAt: versionRow.superseded_at,
            publishedAt: versionRow.published_at,
          },
          processingJob: {
            id: jobRow.id,
            versionId: jobRow.version_id,
            jobType: jobRow.job_type,
            status: jobRow.status,
            attemptCount: jobRow.attempt_count,
            lastError: jobRow.last_error,
            startedAt: jobRow.started_at,
            finishedAt: jobRow.finished_at,
            nextAttemptAt: jobRow.next_attempt_at,
            createdAt: jobRow.created_at,
            updatedAt: jobRow.updated_at,
          },
          chunks: chunkRows.map((row) => ({
            id: row.id,
            versionId: row.version_id,
            ordinal: row.ordinal,
            text: row.text,
            tokenCount: row.token_count,
            pageNumber: row.page_number,
            headingPath: row.heading_path,
            charStart: row.char_start,
            charEnd: row.char_end,
            metadata: JSON.parse(row.metadata || '{}'),
          })),
        });
      } finally {
        db.close();
      }
    },
  },
  notes: {
    list: (course?: string) => {
      const db = getSqliteDb();
      try {
        const rows = course
          ? db.prepare('SELECT * FROM notes WHERE course=? ORDER BY date DESC').all(course)
          : db.prepare('SELECT * FROM notes ORDER BY date DESC').all();

        return Promise.resolve(rows);
      } finally {
        db.close();
      }
    },
  },
  assignments: {
    list: (course?: string) => {
      const db = getSqliteDb();
      try {
        const rows = course
          ? db
              .prepare(
                'SELECT id,title,course,due_date as dueDate,status,grade,max_grade as maxGrade,weight FROM assignments WHERE course=? ORDER BY due_date',
              )
              .all(course)
          : db
              .prepare(
                'SELECT id,title,course,due_date as dueDate,status,grade,max_grade as maxGrade,weight FROM assignments ORDER BY due_date',
              )
              .all();

        return Promise.resolve(rows);
      } finally {
        db.close();
      }
    },
  },
  quizzes: {
    list: (course?: string) => {
      const db = getSqliteDb();
      try {
        const quizRows: any[] = course
          ? db
              .prepare(
                'SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes WHERE course=?',
              )
              .all(course)
          : db
              .prepare(
                'SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes',
              )
              .all();

        const result = quizRows.map((q) => {
          const questions = db
            .prepare('SELECT id,question,options,correct,explanation FROM quiz_questions WHERE quiz_id=? ORDER BY order_idx')
            .all(q.id) as any[];

          return {
            ...q,
            aiGenerated: Boolean(q.aiGenerated),
            bestScore: q.bestScore ?? null,
            questions: questions.map((qq) => ({ ...qq, options: JSON.parse(qq.options) })),
          };
        });

        return Promise.resolve(result);
      } finally {
        db.close();
      }
    },
    getById: (id: string) => {
      const db = getSqliteDb();
      try {
        const q: any = db
          .prepare(
            'SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes WHERE id=?',
          )
          .get(id);

        if (!q) {
          return Promise.resolve(null);
        }

        const questions = db
          .prepare('SELECT id,question,options,correct,explanation FROM quiz_questions WHERE quiz_id=? ORDER BY order_idx')
          .all(q.id) as any[];

        return Promise.resolve({
          ...q,
          aiGenerated: Boolean(q.aiGenerated),
          bestScore: q.bestScore ?? null,
          questions: questions.map((qq) => ({ ...qq, options: JSON.parse(qq.options) })),
        });
      } finally {
        db.close();
      }
    },
  },
  flashcards: {
    list: (deck?: string) => {
      const db = getSqliteDb();
      try {
        const rows: any[] = deck
          ? db.prepare('SELECT id,deck,front,back,ai_generated as aiGenerated FROM flashcards WHERE deck=?').all(deck)
          : db.prepare('SELECT id,deck,front,back,ai_generated as aiGenerated FROM flashcards').all();

        return Promise.resolve(rows.map((r) => ({ ...r, aiGenerated: Boolean(r.aiGenerated) })));
      } finally {
        db.close();
      }
    },
  },
  videos: {
    list: (course?: string) => {
      const db = getSqliteDb();
      try {
        const rows = course
          ? db
              .prepare(
                'SELECT id,title,channel,thumbnail,duration,views,relevance,course,uploaded_ago as uploadedAgo FROM videos WHERE course=? ORDER BY relevance DESC',
              )
              .all(course)
          : db
              .prepare(
                'SELECT id,title,channel,thumbnail,duration,views,relevance,course,uploaded_ago as uploadedAgo FROM videos ORDER BY relevance DESC',
              )
              .all();

        return Promise.resolve(rows);
      } finally {
        db.close();
      }
    },
  },
  studyPlan: {
    listByUser: (userId: string) => {
      const db = getSqliteDb();
      try {
        const rows: any[] = db
          .prepare(
            'SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE user_id=? ORDER BY due_date,time',
          )
          .all(userId);

        return Promise.resolve(rows.map((r) => ({ ...r, completed: Boolean(r.completed) })));
      } finally {
        db.close();
      }
    },
    create: (userId: string, payload: { title: string; course: string; dueDate: string; time?: string; duration?: number; type?: string }) => {
      const db = getSqliteDb();
      try {
        const { title, course, dueDate, time, duration, type } = payload;
        const id = `sp${randomUUID().slice(0, 8)}`;
        db.prepare(
          'INSERT INTO study_plan (id,user_id,title,course,due_date,time,duration,type,completed) VALUES (?,?,?,?,?,?,?,?,0)',
        ).run(id, userId, title, course, dueDate, time || '09:00', duration || 60, type || 'study');

        const row: any = db
          .prepare(
            'SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE id=?',
          )
          .get(id);

        return Promise.resolve({ ...row, completed: Boolean(row.completed) });
      } finally {
        db.close();
      }
    },
    toggle: (id: string, userId: string) => {
      const db = getSqliteDb();
      try {
        const row: any = db.prepare('SELECT * FROM study_plan WHERE id=?').get(id);

        if (!row) {
          return Promise.resolve(null);
        }

        if (row.user_id !== userId) {
          return Promise.resolve('forbidden' as const);
        }

        db.prepare('UPDATE study_plan SET completed=? WHERE id=?').run(row.completed ? 0 : 1, id);

        const updated: any = db
          .prepare(
            'SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE id=?',
          )
          .get(id);

        return Promise.resolve({ ...updated, completed: Boolean(updated.completed) });
      } finally {
        db.close();
      }
    },
  },
  analytics: {
    getByUser: (userId: string) => {
      const db = getSqliteDb();
      try {
        const row: any = db.prepare('SELECT * FROM analytics_snapshots WHERE user_id=?').get(userId);

        if (!row) {
          return Promise.resolve(null);
        }

        return Promise.resolve({
          overallGrade: row.overall_grade,
          quizAverage: row.quiz_average,
          studyHours: row.study_hours,
          assignmentsDone: row.assignments_done,
          assignmentsTotal: row.assignments_total,
          dayStreak: row.day_streak,
          coursesActive: row.courses_active,
          weeklyProgress: JSON.parse(row.weekly_progress),
          recentQuizScores: JSON.parse(row.recent_quiz_scores),
          subjectStrengths: JSON.parse(row.subject_strengths),
          radarData: JSON.parse(row.radar_data),
        });
      } finally {
        db.close();
      }
    },
    initialize: (userId: string) => {
      const db = getSqliteDb();
      try {
        const analyticsId = `a${randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO analytics_snapshots (
            id,
            user_id,
            overall_grade,
            quiz_average,
            study_hours,
            assignments_done,
            assignments_total,
            day_streak,
            courses_active,
            weekly_progress,
            recent_quiz_scores,
            subject_strengths,
            radar_data,
            updated_at
          ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, '[]', '[]', '[]', '[]', datetime('now'))
        `).run(analyticsId, userId);

        return Promise.resolve(true);
      } finally {
        db.close();
      }
    },
  },
  forum: {
    listThreads: (course?: string) => {
      const db = getSqliteDb();
      try {
        const threads: any[] = course
          ? db.prepare('SELECT * FROM forum_threads WHERE course=? ORDER BY created_at DESC').all(course)
          : db.prepare('SELECT * FROM forum_threads ORDER BY created_at DESC').all();

        const result = threads.map((t) => {
          const replies: any[] = db
            .prepare('SELECT id,thread_id as threadId,author,author_role as authorRole,content,timestamp FROM forum_replies WHERE thread_id=? ORDER BY timestamp')
            .all(t.id);

          return {
            id: t.id,
            title: t.title,
            course: t.course,
            author: t.author,
            authorRole: t.author_role,
            replies: replies.length,
            views: t.views,
            tags: JSON.parse(t.tags),
            solved: Boolean(t.solved),
            lastActivity: t.last_activity,
            content: t.content,
            replyList: replies,
          };
        });

        return Promise.resolve(result);
      } finally {
        db.close();
      }
    },
    getThread: (id: string) => {
      const db = getSqliteDb();
      try {
        const t: any = db.prepare('SELECT * FROM forum_threads WHERE id=?').get(id);
        if (!t) {
          return Promise.resolve(null);
        }

        const replies: any[] = db
          .prepare('SELECT id,thread_id as threadId,author,author_role as authorRole,content,timestamp FROM forum_replies WHERE thread_id=? ORDER BY timestamp')
          .all(t.id);

        return Promise.resolve({
          id: t.id,
          title: t.title,
          course: t.course,
          author: t.author,
          authorRole: t.author_role,
          replies: replies.length,
          views: t.views,
          tags: JSON.parse(t.tags),
          solved: Boolean(t.solved),
          lastActivity: t.last_activity,
          content: t.content,
          replyList: replies,
        });
      } finally {
        db.close();
      }
    },
    createThread: (payload: { title: string; course: string; author?: string; authorRole?: string; content?: string; tags?: any[] }) => {
      const db = getSqliteDb();
      try {
        const { title, course, author, authorRole, content, tags } = payload;
        const id = `ft${randomUUID().slice(0, 8)}`;
        db.prepare(
          'INSERT INTO forum_threads (id,title,course,author,author_role,content,tags,views,solved,last_activity) VALUES (?,?,?,?,?,?,?,0,0,?)',
        ).run(id, title, course, author || 'Anonymous', authorRole || 'student', content || '', JSON.stringify(tags || []), 'just now');

        const t: any = db.prepare('SELECT * FROM forum_threads WHERE id=?').get(id);

        return Promise.resolve({
          id: t.id,
          title: t.title,
          course: t.course,
          author: t.author,
          authorRole: t.author_role,
          replies: 0,
          views: 0,
          tags: JSON.parse(t.tags),
          solved: false,
          lastActivity: 'just now',
          content: t.content,
          replyList: [],
        });
      } finally {
        db.close();
      }
    },
    createReply: (threadId: string, payload: { author?: string; authorRole?: string; content: string }) => {
      const db = getSqliteDb();
      try {
        const { author, authorRole, content } = payload;
        const replyId = `r${randomUUID().slice(0, 8)}`;
        db.prepare('INSERT INTO forum_replies (id,thread_id,author,author_role,content,timestamp) VALUES (?,?,?,?,?,?)').run(
          replyId,
          threadId,
          author || 'Anonymous',
          authorRole || 'student',
          content,
          'just now',
        );

        db.prepare('UPDATE forum_threads SET last_activity=? WHERE id=?').run('just now', threadId);

        return Promise.resolve({
          id: replyId,
          threadId,
          author: author || 'Anonymous',
          authorRole: authorRole || 'student',
          content,
          timestamp: 'just now',
        });
      } finally {
        db.close();
      }
    },
  },
  admin: {
    getStats: () => {
      const db = getSqliteDb();
      try {
        const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get() as any).c;
        const lecturers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='lecturer'").get() as any).c;
        const totalCourses = (db.prepare('SELECT COUNT(*) as c FROM courses').get() as any).c;
        const activeUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get() as any).c;
        const notesUploaded = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as any).c;
        const quizzesTaken = (db.prepare('SELECT COUNT(*) as c FROM quizzes WHERE best_score IS NOT NULL').get() as any).c;

        return Promise.resolve({ totalStudents, lecturers, courses: totalCourses, activeUsers, notesUploaded, quizzesTaken });
      } finally {
        db.close();
      }
    },
    listUsers: (search?: string) => {
      const db = getSqliteDb();
      try {
        const rows: any[] = search
          ? db
              .prepare("SELECT id,name,email,role,status,joined,avatar FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY joined DESC")
              .all(`%${search}%`, `%${search}%`)
          : db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users ORDER BY joined DESC').all();

        return Promise.resolve(rows);
      } finally {
        db.close();
      }
    },
    updateUserStatus: (id: string, status: 'active' | 'suspended') => {
      const db = getSqliteDb();
      try {
        db.prepare('UPDATE users SET status=? WHERE id=?').run(status, id);
        const row = db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users WHERE id=?').get(id);

        return Promise.resolve(row ?? null);
      } finally {
        db.close();
      }
    },
  },
  sessions: {
    create: (token: string, user: SessionUser) => {
      const db = getSqliteDb();
      try {
        ensureSqliteSessionTable(db);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(
          'INSERT INTO sessions (id, id_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(token, token, user.id, expiresAt, new Date().toISOString(), new Date().toISOString());

        return Promise.resolve({ token, expiresAt });
      } finally {
        db.close();
      }
    },
    validate: (token: string) => {
      const db = getSqliteDb();
      try {
        ensureSqliteSessionTable(db);
        const row: any = db.prepare('SELECT * FROM sessions WHERE id=?').get(token);
        return Promise.resolve(row ?? null);
      } finally {
        db.close();
      }
    },
    revoke: (token: string) => {
      const db = getSqliteDb();
      try {
        ensureSqliteSessionTable(db);
        db.prepare('DELETE FROM sessions WHERE id=?').run(token);
        return Promise.resolve(true);
      } finally {
        db.close();
      }
    },
  },
};

sqliteRepository.learningResources = {
  ...sqliteRepository.learningResources,
  ...sqliteRepository.contentIngestion,
};

sqliteRepository.knowledge = {
  searchChunks: (payload: { versionIds: string[]; query: string; limit: number }) => {
    if (payload.versionIds.length === 0) return Promise.resolve([]);
    const db = getSqliteDb();
    try {
      const versionPlaceholders = payload.versionIds.map(() => '?').join(',');
      const terms = payload.query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/gu).filter(Boolean);
      if (terms.length === 0) return Promise.resolve([]);
      const termClauses = terms.map(() => "LOWER(cc.text || ' ' || cc.heading_path) LIKE ?").join(' AND ');
      const rows = db.prepare(
        `SELECT cc.id AS chunk_id, cc.version_id, cc.text, cc.page_number, cc.heading_path, cc.metadata,
                cv.resource_id, cv.version_number, lr.title, lr.course_id, lr.published_at,
                c.code AS course_code, c.title AS course_title
         FROM content_chunks cc
         JOIN content_versions cv ON cv.id = cc.version_id
         JOIN learning_resources lr ON lr.id = cv.resource_id
         JOIN courses c ON c.id = lr.course_id
         WHERE cc.version_id IN (${versionPlaceholders})
           AND cv.extraction_status = 'completed'
           AND cv.superseded_at IS NULL
           AND lr.status = 'published'
           AND lr.visibility = 'course'
           AND lr.current_version_id = cv.id
           AND ${termClauses}
         ORDER BY cc.ordinal ASC, cc.id ASC
         LIMIT ?`,
      ).all(...payload.versionIds, ...terms.map((term) => `%${term}%`), payload.limit);
      return Promise.resolve(rows);
    } finally {
      db.close();
    }
  },
};

sqliteRepository.tutor = {
  createConversation: (payload: { userId: string; courseId?: string; topic?: string }) => {
    const db = getSqliteDb();
    try {
      const id = `tc${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tutor_conversations (id, user_id, course_id, topic, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, payload.userId, payload.courseId ?? null, payload.topic ?? null, now, now);
      return Promise.resolve({ id, userId: payload.userId, courseId: payload.courseId ?? null, topic: payload.topic ?? null });
    } finally {
      db.close();
    }
  },
  getConversation: (id: string, userId: string) => {
    const db = getSqliteDb();
    try {
      const row = db.prepare('SELECT id, user_id, course_id, topic FROM tutor_conversations WHERE id = ? AND user_id = ? AND archived = 0').get(id, userId) as any;
      return Promise.resolve(row ? { id: row.id, userId: row.user_id, courseId: row.course_id, topic: row.topic } : null);
    } finally {
      db.close();
    }
  },
  listMessages: (conversationId: string, userId: string, limit = 12) => {
    const db = getSqliteDb();
    try {
      const rows = db.prepare('SELECT m.id, m.role, m.content, m.sequence, m.created_at, m.mode, m.grounding_status FROM tutor_messages m JOIN tutor_conversations c ON c.id = m.conversation_id WHERE m.conversation_id = ? AND c.user_id = ? ORDER BY m.sequence DESC LIMIT ?').all(conversationId, userId, limit) as any[];
      return Promise.resolve(rows.reverse().map((row) => ({ id: row.id, role: row.role, content: row.content, sequence: row.sequence, createdAt: row.created_at, mode: row.mode, groundingStatus: row.grounding_status })));
    } finally {
      db.close();
    }
  },
  appendMessage: (payload: { conversationId: string; userId: string; role: 'user' | 'assistant'; content: string; mode?: string; groundingStatus?: string }) => {
    const db = getSqliteDb();
    try {
      const conversation = db.prepare('SELECT id FROM tutor_conversations WHERE id = ? AND user_id = ? AND archived = 0').get(payload.conversationId, payload.userId);
      if (!conversation) return Promise.resolve(null);
      const next = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM tutor_messages WHERE conversation_id = ?').get(payload.conversationId) as { sequence: number };
      const id = `tm${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tutor_messages (id, conversation_id, role, content, sequence, created_at, mode, grounding_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, payload.conversationId, payload.role, payload.content, next.sequence, now, payload.mode ?? null, payload.groundingStatus ?? null);
      db.prepare('UPDATE tutor_conversations SET updated_at = ? WHERE id = ?').run(now, payload.conversationId);
      return Promise.resolve({ id, sequence: next.sequence });
    } finally {
      db.close();
    }
  },
};

const supabaseRepository: any = {
  users: {
    list: async () => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').select('*').order('joined', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapUser(row));
    },
    getById: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapUser(data);
    },
    getByEmail: async (email: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      return mapUser(data, true);
    },
    create: async (input: Record<string, unknown>) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('users')
        .insert({
          id: input.id || `u${randomUUID().slice(0, 8)}`,
          name: input.name,
          email: input.email,
          password_hash: input.passwordHash,
          role: input.role || 'student',
          avatar: input.avatar || '',
          program: input.program || '',
          year: input.year || 1,
          department: input.department || '',
          streak: input.streak || 0,
          status: input.status || 'active',
          joined: input.joined || new Date().toISOString().split('T')[0],
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapUser(data);
    },
    updateStatus: async (id: string, status: 'active' | 'suspended') => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').update({ status }).eq('id', id).select('*').maybeSingle();
      if (error) throw error;
      return mapUser(data);
    },
  },
  courses: {
    list: async () => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('courses').select('*').order('code');
      if (error) throw error;
      return (data ?? []).map(mapCourse);
    },
    getByIdOrCode: async (idOrCode: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('courses')
        .select('*')
        .or(`id.eq.${idOrCode},code.eq.${idOrCode}`)
        .maybeSingle();

      if (error) throw error;
      return mapCourse(data);
    },
  },
  courseMemberships: {
    listForUser: async (userId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('course_memberships').select('*').eq('user_id', userId).eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
    isUserAuthorizedForCourse: async (userId: string, courseId: string, role?: 'student' | 'lecturer' | 'admin') => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const allowedRoles = role === 'lecturer' ? ['lecturer', 'admin'] : ['student', 'lecturer', 'admin'];
      const { data, error } = await client
        .from('course_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .in('role', allowedRoles as string[]);

      if (error) throw error;
      return Boolean(data && data.length > 0);
    },
  },
  learningResources: {
    list: async (courseId?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client
        .from('learning_resources')
        .select('*, course:course_id(code,title), owner:owner_user_id(name)');

      if (courseId) query = query.eq('course_id', courseId);

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        courseId: row.course_id,
        courseCode: row.course?.code,
        courseTitle: row.course?.title,
        title: row.title,
        resourceType: row.resource_type,
        ownerUserId: row.owner_user_id,
        ownerName: row.owner?.name,
        createdBy: row.created_by,
        visibility: row.visibility,
        status: row.status,
        currentVersionId: row.current_version_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
      }));
    },
    getById: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('learning_resources')
        .select('*, course:course_id(code,title), owner:owner_user_id(name)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        courseId: data.course_id,
        courseCode: data.course?.code,
        courseTitle: data.course?.title,
        title: data.title,
        resourceType: data.resource_type,
        ownerUserId: data.owner_user_id,
        ownerName: data.owner?.name,
        createdBy: data.created_by,
        visibility: data.visibility,
        status: data.status,
        currentVersionId: data.current_version_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
      };
    },
    create: async (payload: {
      courseId: string;
      title: string;
      resourceType?: string;
      ownerUserId?: string | null;
      createdBy: string;
      visibility?: string;
      status?: string;
      currentVersionId?: string | null;
    }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const now = new Date().toISOString();
      const id = `lr${randomUUID().slice(0, 8)}`;

      const { data, error } = await client
        .from('learning_resources')
        .insert({
          id,
          course_id: payload.courseId,
          title: payload.title,
          resource_type: payload.resourceType || 'document',
          owner_user_id: payload.ownerUserId ?? null,
          created_by: payload.createdBy,
          visibility: payload.visibility || 'course',
          status: payload.status || 'draft',
          current_version_id: payload.currentVersionId ?? null,
          created_at: now,
          updated_at: now,
          published_at: null,
        })
        .select('*, course:course_id(code,title), owner:owner_user_id(name)')
        .single();

      if (error) throw error;
      return {
        id: data.id,
        courseId: data.course_id,
        courseCode: data.course?.code,
        courseTitle: data.course?.title,
        title: data.title,
        resourceType: data.resource_type,
        ownerUserId: data.owner_user_id,
        ownerName: data.owner?.name,
        createdBy: data.created_by,
        visibility: data.visibility,
        status: data.status,
        currentVersionId: data.current_version_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
      };
    },
    update: async (id: string, patch: Partial<{ title: string; courseId: string; resourceType: string; ownerUserId: string | null; visibility: string; status: string; currentVersionId: string | null }>) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const updatePayload: Record<string, unknown> = {
        ...(
          patch.title !== undefined ? { title: patch.title } : {}
        ),
        ...(
          patch.courseId !== undefined ? { course_id: patch.courseId } : {}
        ),
        ...(
          patch.resourceType !== undefined ? { resource_type: patch.resourceType } : {}
        ),
        ...(
          patch.ownerUserId !== undefined ? { owner_user_id: patch.ownerUserId } : {}
        ),
        ...(
          patch.visibility !== undefined ? { visibility: patch.visibility } : {}
        ),
        ...(
          patch.status !== undefined ? { status: patch.status } : {}
        ),
        ...(
          patch.currentVersionId !== undefined ? { current_version_id: patch.currentVersionId } : {}
        ),
        updated_at: new Date().toISOString(),
      };

      if (patch.status === 'published') {
        updatePayload.published_at = new Date().toISOString();
      }

      const { data, error } = await client
        .from('learning_resources')
        .update(updatePayload)
        .eq('id', id)
        .select('*, course:course_id(code,title), owner:owner_user_id(name)')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        courseId: data.course_id,
        courseCode: data.course?.code,
        courseTitle: data.course?.title,
        title: data.title,
        resourceType: data.resource_type,
        ownerUserId: data.owner_user_id,
        ownerName: data.owner?.name,
        createdBy: data.created_by,
        visibility: data.visibility,
        status: data.status,
        currentVersionId: data.current_version_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publishedAt: data.published_at,
      };
    },
    listVersions: async (resourceId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('content_versions')
        .select('*')
        .eq('resource_id', resourceId)
        .order('version_number', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        resourceId: row.resource_id,
        versionNumber: row.version_number,
        checksum: row.checksum,
        mimeType: row.mime_type,
        byteSize: row.byte_size,
        storageReference: row.storage_reference,
        extractionStatus: row.extraction_status,
        createdBy: row.created_by,
        createdAt: row.created_at,
        supersededAt: row.superseded_at,
        publishedAt: row.published_at,
      }));
    },
    ingestTextContent: async (payload: { resourceId: string; mimeType?: string; content: string; createdBy: string }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const text = normalizeTextContent(payload.content);
      if (!text) return null;

      const { data: resource, error: resourceError } = await client
        .from('learning_resources')
        .select('id')
        .eq('id', payload.resourceId)
        .maybeSingle();
      if (resourceError) throw resourceError;
      if (!resource) return null;

      const { data: latest, error: latestError } = await client
        .from('content_versions')
        .select('version_number')
        .eq('resource_id', payload.resourceId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const versionId = `cv${randomUUID().slice(0, 8)}`;
      const jobId = `cj${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const checksum = createHash('sha256').update(text).digest('hex');
      const chunks = buildContentChunks(text);
      const version = {
        id: versionId,
        resource_id: payload.resourceId,
        version_number: Number(latest?.version_number ?? 0) + 1,
        checksum,
        mime_type: payload.mimeType || 'text/plain',
        byte_size: Buffer.byteLength(text, 'utf8'),
        storage_reference: null,
        extraction_status: 'completed',
        created_by: payload.createdBy,
        created_at: now,
        superseded_at: null,
        published_at: null,
      };

      const { data: versionRow, error: versionError } = await client.from('content_versions').insert(version).select('*').single();
      if (versionError) throw versionError;

      const { data: jobRow, error: jobError } = await client
        .from('content_processing_jobs')
        .insert({
          id: jobId,
          version_id: versionId,
          job_type: 'text_extraction',
          status: 'completed',
          attempt_count: 1,
          last_error: null,
          started_at: now,
          finished_at: now,
          next_attempt_at: null,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();
      if (jobError) throw jobError;

      const { data: chunkRows, error: chunkError } = await client
        .from('content_chunks')
        .insert(chunks.map((chunk) => ({
          id: chunk.id,
          version_id: versionId,
          ordinal: chunk.ordinal,
          text: chunk.text,
          token_count: chunk.tokenCount,
          page_number: chunk.pageNumber,
          heading_path: chunk.headingPath,
          char_start: chunk.charStart,
          char_end: chunk.charEnd,
          metadata: chunk.metadata,
          created_at: now,
        })))
        .select('*');
      if (chunkError) throw chunkError;

      const { error: resourceUpdateError } = await client
        .from('learning_resources')
        .update({ current_version_id: versionId, updated_at: now })
        .eq('id', payload.resourceId);
      if (resourceUpdateError) throw resourceUpdateError;

      return {
        version: {
          id: versionRow.id,
          resourceId: versionRow.resource_id,
          versionNumber: versionRow.version_number,
          checksum: versionRow.checksum,
          mimeType: versionRow.mime_type,
          byteSize: versionRow.byte_size,
          storageReference: versionRow.storage_reference,
          extractionStatus: versionRow.extraction_status,
          createdBy: versionRow.created_by,
          createdAt: versionRow.created_at,
          supersededAt: versionRow.superseded_at,
          publishedAt: versionRow.published_at,
        },
        processingJob: {
          id: jobRow.id,
          versionId: jobRow.version_id,
          jobType: jobRow.job_type,
          status: jobRow.status,
          attemptCount: jobRow.attempt_count,
          lastError: jobRow.last_error,
          startedAt: jobRow.started_at,
          finishedAt: jobRow.finished_at,
          nextAttemptAt: jobRow.next_attempt_at,
          createdAt: jobRow.created_at,
          updatedAt: jobRow.updated_at,
        },
        chunks: (chunkRows ?? []).map((row: any) => ({
          id: row.id,
          versionId: row.version_id,
          ordinal: row.ordinal,
          text: row.text,
          tokenCount: row.token_count,
          pageNumber: row.page_number,
          headingPath: row.heading_path,
          charStart: row.char_start,
          charEnd: row.char_end,
          metadata: row.metadata ?? {},
        })),
      };
    },
    createProcessingIntent: async (payload: { resourceId: string; mimeType: string; byteSize: number; checksum: string; createdBy: string }) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const { data: resource, error: resourceError } = await client.from('learning_resources').select('id').eq('id', payload.resourceId).maybeSingle();
      if (resourceError) throw resourceError;
      if (!resource) return null;
      const { data: latest, error: latestError } = await client.from('content_versions').select('version_number').eq('resource_id', payload.resourceId).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw latestError;
      const { data: duplicate, error: duplicateError } = await client.from('content_versions').select('id, version_number, content_processing_jobs(id)').eq('resource_id', payload.resourceId).eq('checksum', payload.checksum).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (duplicateError) throw duplicateError;
      const duplicateJob = Array.isArray(duplicate?.content_processing_jobs) ? duplicate.content_processing_jobs[0] : duplicate?.content_processing_jobs;
      if (duplicate && duplicateJob) return { versionId: duplicate.id, jobId: duplicateJob.id, versionNumber: duplicate.version_number, duplicate: true };
      const versionId = `cv${randomUUID().slice(0, 8)}`;
      const jobId = `cj${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const versionNumber = Number(latest?.version_number ?? 0) + 1;
      const { error: versionError } = await client.from('content_versions').insert({ id: versionId, resource_id: payload.resourceId, version_number: versionNumber, checksum: payload.checksum, mime_type: payload.mimeType, byte_size: payload.byteSize, extraction_status: 'queued', created_by: payload.createdBy, created_at: now });
      if (versionError) throw versionError;
      const { error: jobError } = await client.from('content_processing_jobs').insert({ id: jobId, version_id: versionId, job_type: 'text_extraction', status: 'queued', attempt_count: 0, created_at: now, updated_at: now });
      if (jobError) {
        await client.from('content_versions').delete().eq('id', versionId);
        throw jobError;
      }
      return { versionId, jobId, versionNumber };
    },
    setVersionStorageReference: async (versionId: string, storageReference: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const { error } = await client.from('content_versions').update({ storage_reference: storageReference }).eq('id', versionId);
      if (error) throw error;
    },
    startProcessing: async (versionId: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const now = new Date().toISOString();
      const { data, error } = await client.from('content_processing_jobs').update({ status: 'processing', attempt_count: 1, started_at: now, updated_at: now }).eq('version_id', versionId).eq('status', 'queued').select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Invalid processing transition');
      const { error: versionError } = await client.from('content_versions').update({ extraction_status: 'processing' }).eq('id', versionId);
      if (versionError) throw versionError;
    },
    completeProcessing: async (payload: { versionId: string; text: string; sections: Array<{ text: string; pageNumber?: number; slideNumber?: number; headingPath?: string }> }) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const now = new Date().toISOString();
      const { data: version, error: versionLookupError } = await client.from('content_versions').select('resource_id').eq('id', payload.versionId).maybeSingle();
      if (versionLookupError) throw versionLookupError;
      if (!version) return null;
      const { data: job, error: jobLookupError } = await client.from('content_processing_jobs').select('id').eq('version_id', payload.versionId).eq('status', 'processing').maybeSingle();
      if (jobLookupError) throw jobLookupError;
      if (!job) throw new Error('Invalid processing transition');
      const chunks = buildContentChunks(payload.text, payload.sections);
      const { error: chunkError } = await client.from('content_chunks').insert(chunks.map((chunk) => ({ id: chunk.id, version_id: payload.versionId, ordinal: chunk.ordinal, text: chunk.text, token_count: chunk.tokenCount, page_number: chunk.pageNumber, heading_path: chunk.headingPath, char_start: chunk.charStart, char_end: chunk.charEnd, metadata: chunk.metadata, created_at: now })));
      if (chunkError) throw chunkError;
      const { error: jobError } = await client.from('content_processing_jobs').update({ status: 'completed', finished_at: now, last_error: null, updated_at: now }).eq('id', job.id).eq('status', 'processing');
      if (jobError) throw jobError;
      const { error: versionError } = await client.from('content_versions').update({ extraction_status: 'completed' }).eq('id', payload.versionId);
      if (versionError) throw versionError;
      const { error: resourceError } = await client.from('learning_resources').update({ current_version_id: payload.versionId, updated_at: now }).eq('id', version.resource_id);
      if (resourceError) throw resourceError;
      return { versionId: payload.versionId, status: 'completed', chunks: chunks.length };
    },
    failProcessing: async (versionId: string, errorMessage: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SERVER-side SUPABASE_SERVICE_ROLE_KEY.');
      const now = new Date().toISOString();
      const { error: jobError } = await client.from('content_processing_jobs').update({ status: 'failed', last_error: errorMessage.slice(0, 1000), finished_at: now, updated_at: now }).eq('version_id', versionId).in('status', ['queued', 'processing']);
      if (jobError) throw jobError;
      const { error: versionError } = await client.from('content_versions').update({ extraction_status: 'failed' }).eq('id', versionId);
      if (versionError) throw versionError;
    },
    getProcessing: async (resourceId: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const { data, error } = await client.from('content_versions').select('*, content_processing_jobs(*)').eq('resource_id', resourceId).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const job = Array.isArray(data.content_processing_jobs) ? data.content_processing_jobs[0] : data.content_processing_jobs;
      return { version: { id: data.id, resourceId: data.resource_id, versionNumber: data.version_number, checksum: data.checksum, mimeType: data.mime_type, byteSize: data.byte_size, storageReference: data.storage_reference, extractionStatus: data.extraction_status, createdBy: data.created_by, createdAt: data.created_at, supersededAt: data.superseded_at, publishedAt: data.published_at }, processingJob: job ? { id: job.id, versionId: job.version_id, jobType: job.job_type, status: job.status, attemptCount: job.attempt_count, lastError: job.last_error, startedAt: job.started_at, finishedAt: job.finished_at, nextAttemptAt: job.next_attempt_at, createdAt: job.created_at, updatedAt: job.updated_at } : null };
    },
    getVersionSource: async (resourceId: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const { data, error } = await client.from('content_versions').select('id, storage_reference, mime_type').eq('resource_id', resourceId).not('storage_reference', 'is', null).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? { versionId: data.id, storageReference: data.storage_reference, mimeType: data.mime_type } : null;
    },
    beginRetry: async (resourceId: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      const { data: version, error: versionError } = await client.from('content_versions').select('id, storage_reference, mime_type').eq('resource_id', resourceId).not('storage_reference', 'is', null).order('version_number', { ascending: false }).limit(1).maybeSingle();
      if (versionError) throw versionError;
      if (!version) return null;
      const now = new Date().toISOString();
      const { data: failedJob, error: failedJobError } = await client.from('content_processing_jobs').select('id, attempt_count').eq('version_id', version.id).eq('status', 'failed').maybeSingle();
      if (failedJobError) throw failedJobError;
      if (!failedJob) return null;
      const { data: job, error: jobError } = await client.from('content_processing_jobs').update({ status: 'processing', attempt_count: Number(failedJob.attempt_count ?? 0) + 1, last_error: null, started_at: now, finished_at: null, updated_at: now }).eq('id', failedJob.id).eq('status', 'failed').select('id').maybeSingle();
      if (jobError) throw jobError;
      if (!job) return null;
      const { error: updateError } = await client.from('content_versions').update({ extraction_status: 'processing' }).eq('id', version.id);
      if (updateError) throw updateError;
      return { versionId: version.id, storageReference: version.storage_reference, mimeType: version.mime_type };
    },
  },
  notes: {
    list: async (course?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('notes').select('*');
      if (course) query = query.eq('course', course);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },
  assignments: {
    list: async (course?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('assignments').select('*');
      if (course) query = query.eq('course', course);
      const { data, error } = await query.order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapAssignment);
    },
  },
  quizzes: {
    list: async (course?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('quizzes').select('*');
      if (course) query = query.eq('course', course);
      const { data: quizRows, error } = await query.order('id', { ascending: true });
      if (error) throw error;

      const quizIds = (quizRows ?? []).map((q: any) => q.id);
      let questionRows: any[] = [];

      if (quizIds.length > 0) {
        const { data: rows, error: questionError } = await client
          .from('quiz_questions')
          .select('*')
          .in('quiz_id', quizIds)
          .order('order_idx', { ascending: true });

        if (questionError) throw questionError;
        questionRows = rows ?? [];
      }

      const questionsByQuiz = new Map<string, any[]>();
      for (const question of questionRows) {
        const existing = questionsByQuiz.get(question.quiz_id) ?? [];
        existing.push(mapQuizQuestion(question));
        questionsByQuiz.set(question.quiz_id, existing);
      }

      return (quizRows ?? []).map((q: any) => mapQuiz({ ...q, questions: questionsByQuiz.get(q.id) ?? [] }));
    },
    getById: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data: quiz, error: quizError } = await client.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (quizError) throw quizError;
      if (!quiz) return null;

      const { data: questionRows, error: questionError } = await client
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id)
        .order('order_idx', { ascending: true });

      if (questionError) throw questionError;

      return mapQuiz({ ...quiz, questions: (questionRows ?? []).map(mapQuizQuestion) });
    },
  },
  flashcards: {
    list: async (deck?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('flashcards').select('*');
      if (deck) query = query.eq('deck', deck);
      const { data, error } = await query.order('deck', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapFlashcard);
    },
  },
  videos: {
    list: async (course?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('videos').select('*');
      if (course) query = query.eq('course', course);
      const { data, error } = await query.order('relevance', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapVideo);
    },
  },
  studyPlan: {
    listByUser: async (userId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('study_plan')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(mapStudyPlanItem);
    },
    create: async (userId: string, payload: { title: string; course: string; dueDate: string; time?: string; duration?: number; type?: string }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('study_plan')
        .insert({
          id: `sp${randomUUID().slice(0, 8)}`,
          user_id: userId,
          title: payload.title,
          course: payload.course,
          due_date: payload.dueDate,
          time: payload.time || '09:00',
          duration: payload.duration || 60,
          type: payload.type || 'study',
          completed: false,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapStudyPlanItem(data);
    },
    toggle: async (id: string, userId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data: existing, error: getError } = await client.from('study_plan').select('*').eq('id', id).maybeSingle();
      if (getError) throw getError;
      if (!existing) return null;
      if (existing.user_id !== userId) return 'forbidden' as const;

      const { data, error } = await client
        .from('study_plan')
        .update({ completed: !Boolean(existing.completed) })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return mapStudyPlanItem(data);
    },
  },
  analytics: {
    getByUser: async (userId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('analytics_snapshots').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return {
        overallGrade: data.overall_grade,
        quizAverage: data.quiz_average,
        studyHours: data.study_hours,
        assignmentsDone: data.assignments_done,
        assignmentsTotal: data.assignments_total,
        dayStreak: data.day_streak,
        coursesActive: data.courses_active,
        weeklyProgress: data.weekly_progress ?? [],
        recentQuizScores: data.recent_quiz_scores ?? [],
        subjectStrengths: data.subject_strengths ?? [],
        radarData: data.radar_data ?? [],
      };
    },
    initialize: async (userId: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { error } = await client.from('analytics_snapshots').insert({
        id: `a${randomUUID().slice(0, 8)}`,
        user_id: userId,
        overall_grade: 0,
        quiz_average: 0,
        study_hours: 0,
        assignments_done: 0,
        assignments_total: 0,
        day_streak: 0,
        courses_active: 0,
        weekly_progress: [],
        recent_quiz_scores: [],
        subject_strengths: [],
        radar_data: [],
      });

      if (error) throw error;
      return true;
    },
  },
  forum: {
    listThreads: async (course?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      let query = client.from('forum_threads').select('*');
      if (course) query = query.eq('course', course);
      const { data: threads, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const threadIds = (threads ?? []).map((thread: any) => thread.id);
      let replies: any[] = [];

      if (threadIds.length > 0) {
        const { data: rowReplies, error: repliesError } = await client
          .from('forum_replies')
          .select('*')
          .in('thread_id', threadIds)
          .order('timestamp', { ascending: true });

        if (repliesError) throw repliesError;
        replies = rowReplies ?? [];
      }

      const repliesByThread = new Map<string, any[]>();
      for (const reply of replies) {
        const existing = repliesByThread.get(reply.thread_id) ?? [];
        existing.push(reply);
        repliesByThread.set(reply.thread_id, existing);
      }

      return (threads ?? []).map((thread: any) => ({
        id: thread.id,
        title: thread.title,
        course: thread.course,
        author: thread.author,
        authorRole: thread.author_role,
        replies: repliesByThread.get(thread.id)?.length ?? 0,
        views: thread.views,
        tags: thread.tags ?? [],
        solved: Boolean(thread.solved),
        lastActivity: thread.last_activity,
        content: thread.content,
        replyList: repliesByThread.get(thread.id) ?? [],
      }));
    },
    getThread: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data: thread, error: threadError } = await client.from('forum_threads').select('*').eq('id', id).maybeSingle();
      if (threadError) throw threadError;
      if (!thread) return null;

      const { data: replies, error: repliesError } = await client
        .from('forum_replies')
        .select('*')
        .eq('thread_id', id)
        .order('timestamp', { ascending: true });

      if (repliesError) throw repliesError;

      return {
        id: thread.id,
        title: thread.title,
        course: thread.course,
        author: thread.author,
        authorRole: thread.author_role,
        replies: replies?.length ?? 0,
        views: thread.views,
        tags: thread.tags ?? [],
        solved: Boolean(thread.solved),
        lastActivity: thread.last_activity,
        content: thread.content,
        replyList: replies ?? [],
      };
    },
    createThread: async (payload: { title: string; course: string; author?: string; authorRole?: string; content?: string; tags?: any[] }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client
        .from('forum_threads')
        .insert({
          id: `ft${randomUUID().slice(0, 8)}`,
          title: payload.title,
          course: payload.course,
          author: payload.author || 'Anonymous',
          author_role: payload.authorRole || 'student',
          content: payload.content || '',
          tags: payload.tags || [],
          views: 0,
          solved: false,
          last_activity: 'just now',
        })
        .select('*')
        .single();

      if (error) throw error;

      return {
        id: data.id,
        title: data.title,
        course: data.course,
        author: data.author,
        authorRole: data.author_role,
        replies: 0,
        views: 0,
        tags: data.tags ?? [],
        solved: false,
        lastActivity: 'just now',
        content: data.content,
        replyList: [],
      };
    },
    createReply: async (threadId: string, payload: { author?: string; authorRole?: string; content: string }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data: existingThread, error: threadError } = await client
        .from('forum_threads')
        .select('id')
        .eq('id', threadId)
        .maybeSingle();

      if (threadError) throw threadError;
      if (!existingThread) return null;

      const { data, error } = await client
        .from('forum_replies')
        .insert({
          id: `r${randomUUID().slice(0, 8)}`,
          thread_id: threadId,
          author: payload.author || 'Anonymous',
          author_role: payload.authorRole || 'student',
          content: payload.content,
          timestamp: 'just now',
        })
        .select('*')
        .single();

      if (error) throw error;

      const { error: updateError } = await client
        .from('forum_threads')
        .update({ last_activity: 'just now' })
        .eq('id', threadId);

      if (updateError) throw updateError;

      return {
        id: data.id,
        threadId: data.thread_id,
        author: data.author,
        authorRole: data.author_role,
        content: data.content,
        timestamp: data.timestamp,
      };
    },
  },
  admin: {
    getStats: async () => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { count: totalStudents, error: studentError } = await client
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student');
      if (studentError) throw studentError;

      const { count: lecturers, error: lecturerError } = await client
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'lecturer');
      if (lecturerError) throw lecturerError;

      const { count: totalCourses, error: courseError } = await client
        .from('courses')
        .select('id', { count: 'exact', head: true });
      if (courseError) throw courseError;

      const { count: activeUsers, error: activeError } = await client
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      if (activeError) throw activeError;

      const { count: notesUploaded, error: noteError } = await client
        .from('notes')
        .select('id', { count: 'exact', head: true });
      if (noteError) throw noteError;

      const { count: quizzesTaken, error: quizError } = await client
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .not('best_score', 'is', null);
      if (quizError) throw quizError;

      return {
        totalStudents: totalStudents ?? 0,
        lecturers: lecturers ?? 0,
        courses: totalCourses ?? 0,
        activeUsers: activeUsers ?? 0,
        notesUploaded: notesUploaded ?? 0,
        quizzesTaken: quizzesTaken ?? 0,
      };
    },
    listUsers: async (search?: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').select('*').order('joined', { ascending: false });
      if (error) throw error;

      if (!search) return data ?? [];

      const query = search.toLowerCase();
      return (data ?? []).filter((user: any) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
    },
    updateUserStatus: async (id: string, status: 'active' | 'suspended') => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const { data, error } = await client.from('users').update({ status }).eq('id', id).select('*').maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  },
  sessions: {
    create: async (token: string, user: { id: string; email: string; name: string; role: string; avatar?: string; program?: string; year?: number; department?: string; streak?: number; status?: string }) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const idHash = createHash('sha256').update(token).digest('hex');

      const { error } = await client.from('sessions').insert({
        id: token,
        id_hash: idHash,
        user_id: user.id,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });

      if (error) throw error;
      return { token, expiresAt };
    },
    validate: async (token: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const idHash = createHash('sha256').update(token).digest('hex');
      const { data, error } = await client.from('sessions').select('*').eq('id_hash', idHash).maybeSingle();
      if (error) throw error;
      if (!data) return null;

      if (new Date(data.expires_at).getTime() <= Date.now()) {
        await client.from('sessions').delete().eq('id_hash', idHash);
        return null;
      }

      return data;
    },
    revoke: async (token: string) => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }

      const idHash = createHash('sha256').update(token).digest('hex');
      const { error } = await client.from('sessions').delete().eq('id_hash', idHash);
      if (error) throw error;
      return true;
    },
  },
};

supabaseRepository.knowledge = {
  searchChunks: async (payload: { versionIds: string[]; query: string; limit: number }) => {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    if (payload.versionIds.length === 0) return [];

    const { data, error } = await client.rpc('search_published_content', {
      p_version_ids: payload.versionIds,
      p_query: payload.query,
      p_limit: payload.limit,
    });
    if (error) throw error;
    return data ?? [];
  },
};

supabaseRepository.tutor = {
  createConversation: async (payload: { userId: string; courseId?: string; topic?: string }) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    const id = `tc${randomUUID().slice(0, 8)}`;
    const { error } = await client.from('tutor_conversations').insert({ id, user_id: payload.userId, course_id: payload.courseId ?? null, topic: payload.topic ?? null });
    if (error) throw error;
    return { id, userId: payload.userId, courseId: payload.courseId ?? null, topic: payload.topic ?? null };
  },
  getConversation: async (id: string, userId: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    const { data, error } = await client.from('tutor_conversations').select('id,user_id,course_id,topic').eq('id', id).eq('user_id', userId).eq('archived', false).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, userId: data.user_id, courseId: data.course_id, topic: data.topic } : null;
  },
  listMessages: async (conversationId: string, userId: string, limit = 12) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    const conversation = await supabaseRepository.tutor.getConversation(conversationId, userId);
    if (!conversation) return [];
    const { data, error } = await client.from('tutor_messages').select('id,role,content,sequence,created_at,mode,grounding_status').eq('conversation_id', conversationId).order('sequence', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).reverse().map((row: any) => ({ id: row.id, role: row.role, content: row.content, sequence: row.sequence, createdAt: row.created_at, mode: row.mode, groundingStatus: row.grounding_status }));
  },
  appendMessage: async (payload: { conversationId: string; userId: string; role: 'user' | 'assistant'; content: string; mode?: string; groundingStatus?: string }) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase adapter is not configured. Set SERVER-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    const conversation = await supabaseRepository.tutor.getConversation(payload.conversationId, payload.userId);
    if (!conversation) return null;
    const { data: last, error: lastError } = await client.from('tutor_messages').select('sequence').eq('conversation_id', payload.conversationId).order('sequence', { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw lastError;
    const id = `tm${randomUUID().slice(0, 8)}`;
    const sequence = Number(last?.sequence ?? 0) + 1;
    const { error } = await client.from('tutor_messages').insert({ id, conversation_id: payload.conversationId, role: payload.role, content: payload.content, sequence, mode: payload.mode ?? null, grounding_status: payload.groundingStatus ?? null });
    if (error) throw error;
    await client.from('tutor_conversations').update({ updated_at: new Date().toISOString() }).eq('id', payload.conversationId);
    return { id, sequence };
  },
};

export const databaseProvider = resolveProvider();
export const dataAccess = databaseProvider === 'supabase' ? supabaseRepository : sqliteRepository;

export {
  DATA_ARCHITECTURE,
  ROUTE_DATA_SOURCE_MAP,
  getRuntimeDataSourceStatus,
} from './boundary';
