/**
 * StudyHub AI — SQLite API Router
 * All /api/* routes served directly from the SQLite database.
 */
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  clearAuthSession,
  parseSessionCookie,
  requireAuth,
  requireRole,
  revokeSession,
  setAuthSession,
  type AuthenticatedRequest,
  type Role,
  type SessionUser,
} from '../auth/session';
import { dataAccess } from '../data';

const router = Router();

// ── Courses ───────────────────────────────────────────────────────────────────
router.get('/courses', async (_req: Request, res: Response) => {
  const rows = await dataAccess.courses.list();
  res.json(rows);
});

router.get('/courses/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = await dataAccess.courses.getByIdOrCode(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── Notes ─────────────────────────────────────────────────────────────────────
router.get('/notes', async (req: Request, res: Response) => {
  const { course } = req.query;
  const rows = course ? await dataAccess.notes.list(String(course)) : await dataAccess.notes.list();
  res.json(rows);
});

// ── Assignments ───────────────────────────────────────────────────────────────
router.get('/assignments', async (req: Request, res: Response) => {
  const { course } = req.query;
  const rows = course ? await dataAccess.assignments.list(String(course)) : await dataAccess.assignments.list();
  res.json(rows);
});

// ── Quizzes ───────────────────────────────────────────────────────────────────
router.get('/quizzes', async (req: Request, res: Response) => {
  const { course } = req.query;
  const rows = course ? await dataAccess.quizzes.list(String(course)) : await dataAccess.quizzes.list();
  res.json(rows);
});

router.get('/quizzes/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const q = await dataAccess.quizzes.getById(id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  res.json(q);
});

// ── Flashcards ────────────────────────────────────────────────────────────────
router.get('/flashcards', async (req: Request, res: Response) => {
  const { deck } = req.query;
  const rows = deck ? await dataAccess.flashcards.list(String(deck)) : await dataAccess.flashcards.list();
  res.json(rows);
});

// ── Videos ────────────────────────────────────────────────────────────────────
router.get('/videos', async (req: Request, res: Response) => {
  const { course } = req.query;
  const rows = course ? await dataAccess.videos.list(String(course)) : await dataAccess.videos.list();
  res.json(rows);
});

// ── Study Plan ────────────────────────────────────────────────────────────────
router.get('/study-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const rows = await dataAccess.studyPlan.listByUser(userId);
  res.json(rows);
});

router.post('/study-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { title, course, dueDate, time, duration, type } = req.body;
  if (!title || !course || !dueDate) return res.status(400).json({ error: 'Missing fields' });
  const row = await dataAccess.studyPlan.create(userId, { title, course, dueDate, time, duration, type });
  res.status(201).json(row);
});

router.patch('/study-plan/:id/toggle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await dataAccess.studyPlan.toggle(id, req.user?.id ?? '');

  if (result === null) return res.status(404).json({ error: 'Not found' });
  if (result === 'forbidden') return res.status(403).json({ error: 'Forbidden' });

  res.json(result);
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const row = await dataAccess.analytics.getByUser(userId);
  if (!row) return res.status(404).json({ error: 'No analytics found' });

  res.json(row);
});

// ── Forum ─────────────────────────────────────────────────────────────────────
router.get('/forum', async (req: Request, res: Response) => {
  const { course } = req.query;
  const rows = course ? await dataAccess.forum.listThreads(String(course)) : await dataAccess.forum.listThreads();
  res.json(rows);
});

router.get('/forum/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const thread = await dataAccess.forum.getThread(id);
  if (!thread) return res.status(404).json({ error: 'Not found' });
  res.json(thread);
});

router.post('/forum', async (req: Request, res: Response) => {
  const { title, course, author, authorRole, content, tags } = req.body;
  if (!title || !course) return res.status(400).json({ error: 'Missing fields' });
  const thread = await dataAccess.forum.createThread({ title, course, author, authorRole, content, tags });
  res.status(201).json(thread);
});

router.post('/forum/:id/replies', async (req: Request, res: Response) => {
  const { author, authorRole, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Missing content' });

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reply = await dataAccess.forum.createReply(id, { author, authorRole, content });
  if (!reply) return res.status(404).json({ error: 'Not found' });

  res.status(201).json(reply);
});

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  const stats = await dataAccess.admin.getStats();
  res.json(stats);
});

router.get('/admin/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { search } = req.query;
  const rows = search ? await dataAccess.admin.listUsers(String(search)) : await dataAccess.admin.listUsers();
  res.json(rows);
});

router.patch('/admin/users/:id/status', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = await dataAccess.admin.updateUserStatus(id, status);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── Auth ──────────────────────────────────────────────────────────────────────
const allowedRoles: Role[] = ['student', 'lecturer', 'admin'];

function normalizeRole(role: unknown): Role {
  if (typeof role === 'string' && allowedRoles.includes(role as Role)) {
    return role as Role;
  }
  return 'student';
}

router.post('/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role, program = '', year = 1, department = '' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await dataAccess.users.getByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const normalizedRole = normalizeRole(role);
  const avatar = name.split(' ').map((word: string) => word[0]).join('').toUpperCase().slice(0, 2);
  const user: any = await dataAccess.users.create({
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: normalizedRole,
    avatar,
    program,
    year,
    department,
  });

  await dataAccess.analytics.initialize(user.id);
  const sessionUser: SessionUser = { ...user, role: normalizeRole(user.role), avatar: user.avatar || avatar };
  await setAuthSession(res, sessionUser);
  res.status(201).json({ user: sessionUser, message: 'Registration successful' });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user: any = await dataAccess.users.getByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Please contact support.' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    avatar: user.avatar,
    program: user.program,
    year: user.year,
    department: user.department,
    streak: user.streak,
    status: user.status,
  };
  await setAuthSession(res, sessionUser);
  res.json({ user: sessionUser, message: 'Login successful' });
});

router.post('/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const token = parseSessionCookie(req);
  if (token) {
    await revokeSession(token);
  }
  clearAuthSession(res);
  res.json({ message: 'Logout successful' });
});

// ── User profile ──────────────────────────────────────────────────────────────
router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const user = await dataAccess.users.getById(userId);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

export default router;
