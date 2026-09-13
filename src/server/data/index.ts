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

const sqliteRepository = {
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

const supabaseRepository = {
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

export const databaseProvider = resolveProvider();
export const dataAccess = databaseProvider === 'supabase' ? supabaseRepository : sqliteRepository;

export {
  DATA_ARCHITECTURE,
  ROUTE_DATA_SOURCE_MAP,
  getRuntimeDataSourceStatus,
} from './boundary';
