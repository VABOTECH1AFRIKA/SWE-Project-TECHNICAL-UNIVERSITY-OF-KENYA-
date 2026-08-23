/**
 * StudyHub AI — SQLite API Router
 * All /api/* routes served directly from the SQLite database.
 */
import { Router, type Request, type Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DB_PATH || path.join('/private', 'studyhub.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const router = Router();

// ── Courses ───────────────────────────────────────────────────────────────────
router.get('/courses', (_req: Request, res: Response) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT id,code,title,color,progress,notes_count as notesCount,assignments_count as assignmentsCount,icon,lecturer FROM courses ORDER BY code').all();
    res.json(rows);
  } finally { db.close(); }
});

router.get('/courses/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const row = db.prepare('SELECT id,code,title,color,progress,notes_count as notesCount,assignments_count as assignmentsCount,icon,lecturer FROM courses WHERE id=? OR code=?').get(req.params.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } finally { db.close(); }
});

// ── Notes ─────────────────────────────────────────────────────────────────────
router.get('/notes', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { course } = req.query;
    const rows = course
      ? db.prepare('SELECT * FROM notes WHERE course=? ORDER BY date DESC').all(course)
      : db.prepare('SELECT * FROM notes ORDER BY date DESC').all();
    res.json(rows);
  } finally { db.close(); }
});

// ── Assignments ───────────────────────────────────────────────────────────────
router.get('/assignments', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { course } = req.query;
    const rows = course
      ? db.prepare('SELECT id,title,course,due_date as dueDate,status,grade,max_grade as maxGrade,weight FROM assignments WHERE course=? ORDER BY due_date').all(course)
      : db.prepare('SELECT id,title,course,due_date as dueDate,status,grade,max_grade as maxGrade,weight FROM assignments ORDER BY due_date').all();
    res.json(rows);
  } finally { db.close(); }
});

// ── Quizzes ───────────────────────────────────────────────────────────────────
router.get('/quizzes', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { course } = req.query;
    const quizRows: any[] = course
      ? db.prepare('SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes WHERE course=?').all(course)
      : db.prepare('SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes').all();

    const result = quizRows.map((q) => {
      const questions = db.prepare('SELECT id,question,options,correct,explanation FROM quiz_questions WHERE quiz_id=? ORDER BY order_idx').all(q.id) as any[];
      return {
        ...q,
        aiGenerated: Boolean(q.aiGenerated),
        bestScore: q.bestScore ?? null,
        questions: questions.map((qq) => ({ ...qq, options: JSON.parse(qq.options) })),
      };
    });
    res.json(result);
  } finally { db.close(); }
});

router.get('/quizzes/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const q: any = db.prepare('SELECT id,title,course,difficulty,question_count as questionCount,duration,best_score as bestScore,ai_generated as aiGenerated FROM quizzes WHERE id=?').get(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const questions = db.prepare('SELECT id,question,options,correct,explanation FROM quiz_questions WHERE quiz_id=? ORDER BY order_idx').all(q.id) as any[];
    res.json({ ...q, aiGenerated: Boolean(q.aiGenerated), bestScore: q.bestScore ?? null, questions: questions.map((qq) => ({ ...qq, options: JSON.parse(qq.options) })) });
  } finally { db.close(); }
});

// ── Flashcards ────────────────────────────────────────────────────────────────
router.get('/flashcards', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { deck } = req.query;
    const rows: any[] = deck
      ? db.prepare('SELECT id,deck,front,back,ai_generated as aiGenerated FROM flashcards WHERE deck=?').all(deck)
      : db.prepare('SELECT id,deck,front,back,ai_generated as aiGenerated FROM flashcards').all();
    res.json(rows.map((r) => ({ ...r, aiGenerated: Boolean(r.aiGenerated) })));
  } finally { db.close(); }
});

// ── Videos ────────────────────────────────────────────────────────────────────
router.get('/videos', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { course } = req.query;
    const rows = course
      ? db.prepare('SELECT id,title,channel,thumbnail,duration,views,relevance,course,uploaded_ago as uploadedAgo FROM videos WHERE course=? ORDER BY relevance DESC').all(course)
      : db.prepare('SELECT id,title,channel,thumbnail,duration,views,relevance,course,uploaded_ago as uploadedAgo FROM videos ORDER BY relevance DESC').all();
    res.json(rows);
  } finally { db.close(); }
});

// ── Study Plan ────────────────────────────────────────────────────────────────
router.get('/study-plan', (req: Request, res: Response) => {
  const db = getDb();
  try {
    // Default to demo user u1 if no auth
    const userId = (req as any).userId || 'u1';
    const rows: any[] = db.prepare('SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE user_id=? ORDER BY due_date,time').all(userId);
    res.json(rows.map((r) => ({ ...r, completed: Boolean(r.completed) })));
  } finally { db.close(); }
});

router.post('/study-plan', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const userId = (req as any).userId || 'u1';
    const { title, course, dueDate, time, duration, type } = req.body;
    if (!title || !course || !dueDate) return res.status(400).json({ error: 'Missing fields' });
    const id = `sp${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO study_plan (id,user_id,title,course,due_date,time,duration,type,completed) VALUES (?,?,?,?,?,?,?,?,0)')
      .run(id, userId, title, course, dueDate, time || '09:00', duration || 60, type || 'study');
    const row: any = db.prepare('SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE id=?').get(id);
    res.status(201).json({ ...row, completed: Boolean(row.completed) });
  } finally { db.close(); }
});

router.patch('/study-plan/:id/toggle', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const row: any = db.prepare('SELECT * FROM study_plan WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE study_plan SET completed=? WHERE id=?').run(row.completed ? 0 : 1, req.params.id);
    const updated: any = db.prepare('SELECT id,user_id as userId,title,course,due_date as dueDate,time,duration,type,completed FROM study_plan WHERE id=?').get(req.params.id);
    res.json({ ...updated, completed: Boolean(updated.completed) });
  } finally { db.close(); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const userId = (req as any).userId || 'u1';
    const row: any = db.prepare('SELECT * FROM analytics_snapshots WHERE user_id=?').get(userId);
    if (!row) return res.status(404).json({ error: 'No analytics found' });
    res.json({
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
  } finally { db.close(); }
});

// ── Forum ─────────────────────────────────────────────────────────────────────
router.get('/forum', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { course } = req.query;
    const threads: any[] = course
      ? db.prepare('SELECT * FROM forum_threads WHERE course=? ORDER BY created_at DESC').all(course)
      : db.prepare('SELECT * FROM forum_threads ORDER BY created_at DESC').all();

    const result = threads.map((t) => {
      const replies: any[] = db.prepare('SELECT id,thread_id as threadId,author,author_role as authorRole,content,timestamp FROM forum_replies WHERE thread_id=? ORDER BY timestamp').all(t.id);
      return {
        id: t.id, title: t.title, course: t.course,
        author: t.author, authorRole: t.author_role,
        replies: replies.length, views: t.views,
        tags: JSON.parse(t.tags), solved: Boolean(t.solved),
        lastActivity: t.last_activity, content: t.content,
        replyList: replies,
      };
    });
    res.json(result);
  } finally { db.close(); }
});

router.get('/forum/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const t: any = db.prepare('SELECT * FROM forum_threads WHERE id=?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const replies: any[] = db.prepare('SELECT id,thread_id as threadId,author,author_role as authorRole,content,timestamp FROM forum_replies WHERE thread_id=? ORDER BY timestamp').all(t.id);
    res.json({ id: t.id, title: t.title, course: t.course, author: t.author, authorRole: t.author_role, replies: replies.length, views: t.views, tags: JSON.parse(t.tags), solved: Boolean(t.solved), lastActivity: t.last_activity, content: t.content, replyList: replies });
  } finally { db.close(); }
});

router.post('/forum', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { title, course, author, authorRole, content, tags } = req.body;
    if (!title || !course) return res.status(400).json({ error: 'Missing fields' });
    const id = `ft${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO forum_threads (id,title,course,author,author_role,content,tags,views,solved,last_activity) VALUES (?,?,?,?,?,?,?,0,0,?)')
      .run(id, title, course, author || 'Anonymous', authorRole || 'student', content || '', JSON.stringify(tags || []), 'just now');
    const t: any = db.prepare('SELECT * FROM forum_threads WHERE id=?').get(id);
    res.status(201).json({ id: t.id, title: t.title, course: t.course, author: t.author, authorRole: t.author_role, replies: 0, views: 0, tags: JSON.parse(t.tags), solved: false, lastActivity: 'just now', content: t.content, replyList: [] });
  } finally { db.close(); }
});

router.post('/forum/:id/replies', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { author, authorRole, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });
    const replyId = `r${randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO forum_replies (id,thread_id,author,author_role,content,timestamp) VALUES (?,?,?,?,?,?)')
      .run(replyId, req.params.id, author || 'Anonymous', authorRole || 'student', content, 'just now');
    db.prepare('UPDATE forum_threads SET last_activity=? WHERE id=?').run('just now', req.params.id);
    res.status(201).json({ id: replyId, threadId: req.params.id, author: author || 'Anonymous', authorRole: authorRole || 'student', content, timestamp: 'just now' });
  } finally { db.close(); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats', (_req: Request, res: Response) => {
  const db = getDb();
  try {
    const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get() as any).c;
    const lecturers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role='lecturer'").get() as any).c;
    const totalCourses = (db.prepare('SELECT COUNT(*) as c FROM courses').get() as any).c;
    const activeUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get() as any).c;
    const notesUploaded = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as any).c;
    const quizzesTaken = (db.prepare('SELECT COUNT(*) as c FROM quizzes WHERE best_score IS NOT NULL').get() as any).c;
    res.json({ totalStudents, lecturers, courses: totalCourses, activeUsers, notesUploaded, quizzesTaken });
  } finally { db.close(); }
});

router.get('/admin/users', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { search } = req.query;
    const rows: any[] = search
      ? db.prepare("SELECT id,name,email,role,status,joined,avatar FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY joined DESC").all(`%${search}%`, `%${search}%`)
      : db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users ORDER BY joined DESC').all();
    res.json(rows);
  } finally { db.close(); }
});

router.patch('/admin/users/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE users SET status=? WHERE id=?').run(status, req.params.id);
    const row = db.prepare('SELECT id,name,email,role,status,joined,avatar FROM users WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } finally { db.close(); }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { name, email, password, role = 'student', program = '', year = 1, department = '' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const id = `u${randomUUID().slice(0, 8)}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    const avatar = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const joined = new Date().toISOString().split('T')[0];

    db.prepare('INSERT INTO users (id,name,email,password_hash,role,avatar,program,year,department,streak,status,joined) VALUES (?,?,?,?,?,?,?,?,?,0,?,?)')
      .run(id, name, email, passwordHash, role, avatar, program, year, department, 'active', joined);

    const user: any = db.prepare('SELECT id,name,email,role,avatar,program,year,department,streak,status,joined FROM users WHERE id=?').get(id);
    res.status(201).json({ user, message: 'Registration successful' });
  } finally { db.close(); }
});

router.post('/auth/login', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user: any = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Please contact support.' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        avatar: user.avatar, program: user.program, year: user.year,
        department: user.department, streak: user.streak, status: user.status,
      },
      message: 'Login successful',
    });
  } finally { db.close(); }
});

// ── User profile ──────────────────────────────────────────────────────────────
router.get('/user/me', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const userId = (req as any).userId || 'u1';
    const user: any = db.prepare('SELECT id,name,email,role,avatar,program,year,department,streak,status FROM users WHERE id=?').get(userId);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } finally { db.close(); }
});

export default router;
