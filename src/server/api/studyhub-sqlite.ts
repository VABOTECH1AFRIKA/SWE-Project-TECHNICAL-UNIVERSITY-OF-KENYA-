/**
 * StudyHub AI — SQLite API Router
 * All /api/* routes served directly from the SQLite database.
 */
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import multer, { MulterError } from 'multer';
import type { TutorRequest } from '../../lib/tutor-contract';
import { TutorValidationError, tutorOrchestrator, validateTutorRequest } from '../ai/tutor-orchestrator';
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
import { ingestUploadedFile, retryStoredFile } from '../content-ingestion/service';
import { contentTypeForFilename, isSupportedContentType, type SupportedContentType } from '../content-ingestion/extract';
import { createStorageProvider } from '../content-ingestion/storage';
import { searchKnowledge } from '../knowledge/retrieval';
import { RetrievalValidationError } from '../knowledge/types';

const router = Router();
const MAX_TEXT_INGEST_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);
const storage = createStorageProvider();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => isSupportedContentType(file.mimetype) ? callback(null, true) : callback(new Error('Unsupported upload format')),
});

function uploadMiddleware(req: Request, res: Response, next: (error?: unknown) => void): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File exceeds the 25 MB limit' });
      return;
    }
    if (error instanceof MulterError || error instanceof Error) {
      res.status(415).json({ error: 'Unsupported upload format' });
      return;
    }
    next(error);
  });
}

function hasSafeTextFilename(filename: unknown): boolean {
  if (filename === undefined) return true;
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 255) return false;
  return !/[\\/\0\x00-\x1f\x7f]/.test(filename);
}

function isTextFilenameConsistent(filename: unknown, mimeType: string): boolean {
  if (filename === undefined) return true;
  const expected = contentTypeForFilename(String(filename));
  return expected === mimeType || (mimeType === 'text/markdown' && expected === 'text/markdown');
}

async function assertCourseAuthorization(req: AuthenticatedRequest, courseId?: string): Promise<boolean> {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'admin') return true;

  const targetCourseId = courseId ?? '';
  if (!targetCourseId) return false;

  const isAuthorized = await dataAccess.courseMemberships.isUserAuthorizedForCourse(user.id, targetCourseId, user.role === 'lecturer' ? 'lecturer' : 'student');
  return isAuthorized;
}

async function assertResourceAccess(req: AuthenticatedRequest, resourceId: string): Promise<{ allowed: boolean; resource: any } | null> {
  const resource = await dataAccess.learningResources.getById(resourceId);
  if (!resource) return { allowed: false, resource: null };

  const user = req.user;
  if (!user) return { allowed: false, resource };
  if (user.role === 'admin') return { allowed: true, resource };

  const authorizedCourse = await dataAccess.courseMemberships.isUserAuthorizedForCourse(user.id, resource.courseId, user.role === 'lecturer' ? 'lecturer' : 'student');
  if (user.role === 'lecturer' && authorizedCourse) return { allowed: true, resource };
  if (user.role === 'student') {
    if (resource.status !== 'published') return { allowed: false, resource };
    if (resource.visibility === 'private' && resource.ownerUserId !== user.id) return { allowed: false, resource };
    if (!authorizedCourse) return { allowed: false, resource };
    return { allowed: true, resource };
  }

  return { allowed: false, resource };
}

router.post('/ai/tutor', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = validateTutorRequest(req.body as TutorRequest);
    if (request.courseId && !(await assertCourseAuthorization(req, request.courseId))) {
      res.status(403).json({ error: { code: 'TUTOR_ERROR', message: 'Tutor service is unavailable.' } });
      return;
    }

    let conversation = request.conversationId
      ? await dataAccess.tutor.getConversation(request.conversationId, req.user!.id)
      : null;
    if (request.conversationId && !conversation) {
      res.status(404).json({ error: { code: 'TUTOR_ERROR', message: 'Tutor conversation was not found.' } });
      return;
    }
    if (conversation && request.courseId && conversation.courseId && conversation.courseId !== request.courseId) {
      res.status(403).json({ error: { code: 'TUTOR_ERROR', message: 'Tutor service is unavailable.' } });
      return;
    }
    if (!conversation) {
      conversation = await dataAccess.tutor.createConversation({ userId: req.user!.id, courseId: request.courseId, topic: request.topic });
    }
    await dataAccess.tutor.appendMessage({ conversationId: conversation.id, userId: req.user!.id, role: 'user', content: request.message, mode: request.mode });

    const response = await tutorOrchestrator.respond({ ...request, conversationId: conversation.id }, {
      id: req.user!.id,
      role: req.user!.role,
    });
    await dataAccess.tutor.appendMessage({ conversationId: conversation.id, userId: req.user!.id, role: 'assistant', content: response.answer, mode: response.mode, groundingStatus: response.groundingStatus });
    res.json({ ...response, conversationId: conversation.id });
  } catch (error) {
    if (error instanceof TutorValidationError) {
      res.status(400).json({ error: { code: error.code, message: error.message } });
      return;
    }

    const errorCode = error instanceof Error && error.name === 'TutorOrchestrationError'
      ? 'TUTOR_PROVIDER_OR_RETRIEVAL_FAILED'
      : 'TUTOR_REQUEST_FAILED';
    console.error(JSON.stringify({
      event: 'ai_tutor_request_failed',
      errorCode,
      userId: req.user?.id,
      courseId: req.body?.courseId,
    }));
    res.status(500).json({
      error: {
        code: errorCode,
        message: 'Tutor service is unavailable. Check the provider and course content configuration.',
      },
    });
  }
});

router.post('/knowledge/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await searchKnowledge({
      userId: req.user!.id,
      role: req.user!.role,
      query: req.body?.query,
      courseId: req.body?.courseId,
      topic: req.body?.topic,
      resourceId: req.body?.resourceId,
      maxResults: req.body?.maxResults,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof RetrievalValidationError) {
      res.status(400).json({ error: { code: error.code, message: error.message } });
      return;
    }
    res.status(500).json({ error: 'Knowledge search is unavailable.' });
  }
});

// ── Courses ───────────────────────────────────────────────────────────────────
router.get('/courses', async (_req: Request, res: Response) => {
  const rows = await dataAccess.courses.list();
  res.json(rows);
});

router.get('/courses/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role === 'admin') {
    const rows = await dataAccess.courses.list();
    return res.json(rows);
  }

  const [memberships, rows] = await Promise.all([
    dataAccess.courseMemberships.listForUser(user.id),
    dataAccess.courses.list(),
  ]);
  const ownedCourseIds = memberships
    .map((membership: any) => membership.course_id ?? membership.courseId)
    .filter(Boolean);

  if (!ownedCourseIds.length) {
    return res.json([]);
  }

  const authorized = rows.filter((course: any) => ownedCourseIds.includes(course.id));
  return res.json(authorized);
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

// ── Learning Resources (metadata only) ───────────────────────────────────────
router.get('/learning-resources', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { course } = req.query;
  const user = req.user!;
  const requestedCourse = course ? String(course) : undefined;

  if (user.role === 'admin') {
    const rows = requestedCourse ? await dataAccess.learningResources.list(requestedCourse) : await dataAccess.learningResources.list();
    return res.json(rows);
  }

  if (user.role === 'lecturer') {
    const rows = requestedCourse ? await dataAccess.learningResources.list(requestedCourse) : await dataAccess.learningResources.list();
    const authorized = requestedCourse ? await assertCourseAuthorization(req, requestedCourse) : true;
    if (!authorized) return res.status(403).json({ error: 'Forbidden' });

    const filtered = rows.filter((row: any) => {
      if (row.status === 'draft' || row.status === 'archived') return true;
      return true;
    });
    return res.json(filtered);
  }

  const rows = requestedCourse ? await dataAccess.learningResources.list(requestedCourse) : await dataAccess.learningResources.list();
  const filtered = rows.filter((row: any) => {
    if (row.status !== 'published') return false;
    if (row.visibility === 'private' && row.ownerUserId !== user.id) return false;
    return true;
  });

  if (requestedCourse) {
    const authorized = await assertCourseAuthorization(req, requestedCourse);
    return res.json(authorized ? filtered : []);
  }

  const visibleCourseIds = (await dataAccess.courseMemberships.listForUser(user.id)).map((membership: any) => membership.course_id ?? membership.courseId);
  const visibleRows = filtered.filter((row: any) => visibleCourseIds.includes(row.courseId));
  res.json(visibleRows);
});

router.get('/learning-resources/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const row = await dataAccess.learningResources.getById(id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const access = await assertResourceAccess(req, id);
  if (!access?.allowed) return res.status(403).json({ error: 'Forbidden' });
  res.json(row);
});

router.post('/learning-resources', requireAuth, requireRole('lecturer', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { courseId, title, resourceType, visibility, status } = req.body;
  if (!courseId || !title) return res.status(400).json({ error: 'Course and title are required' });

  const authorized = await assertCourseAuthorization(req, courseId);
  if (!authorized) return res.status(403).json({ error: 'Forbidden' });

  const row = await dataAccess.learningResources.create({
    courseId,
    title,
    resourceType,
    ownerUserId: req.user?.id ?? null,
    createdBy: req.user?.id ?? 'system',
    visibility,
    status,
  });

  if (!row) return res.status(500).json({ error: 'Failed to create resource metadata' });
  res.status(201).json(row);
});

router.patch('/learning-resources/:id', requireAuth, requireRole('lecturer', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = await dataAccess.learningResources.getById(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { courseId, ownerUserId, ...rest } = req.body ?? {};
  const targetCourseId = courseId ?? existing.courseId;
  const canManageCourse = await assertCourseAuthorization(req, targetCourseId);
  if (!canManageCourse) return res.status(403).json({ error: 'Forbidden' });

  const row = await dataAccess.learningResources.update(id, {
    ...rest,
    courseId: targetCourseId,
    ownerUserId: req.user?.id ?? existing.ownerUserId ?? null,
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.get('/learning-resources/:id/versions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const resource = await dataAccess.learningResources.getById(id);
  if (!resource) return res.status(404).json({ error: 'Not found' });

  const access = await assertResourceAccess(req, id);
  if (!access?.allowed) return res.status(403).json({ error: 'Forbidden' });

  const rows = await dataAccess.learningResources.listVersions(id);
  res.json(rows);
});

router.post('/learning-resources/:id/ingest', requireAuth, requireRole('lecturer', 'admin'), uploadMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const resource = await dataAccess.learningResources.getById(id);
  if (!resource) {
    return res.status(404).json({ error: 'Not found' });
  }

  const canManageCourse = await assertCourseAuthorization(req, resource.courseId);
  if (!canManageCourse) return res.status(403).json({ error: 'Forbidden' });

  if (req.file) {
    const filename = req.file.originalname;
    const mimeType = req.file.mimetype;
    if (!isSupportedContentType(mimeType) || !isTextFilenameConsistent(filename, mimeType)) {
      return res.status(400).json({ error: 'Filename is invalid for the supplied content type' });
    }

    try {
      await ingestUploadedFile({
        repository: dataAccess.learningResources,
        storage,
        resourceId: id,
        createdBy: req.user?.id ?? 'system',
        filename,
        mimeType: mimeType as SupportedContentType,
        buffer: req.file.buffer,
      });
      const processing = await dataAccess.learningResources.getProcessing(id);
      return res.status(201).json(processing);
    } catch {
      const processing = await dataAccess.learningResources.getProcessing(id);
      return res.status(422).json({ error: 'Content processing failed', processing });
    }
  }

  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'text/plain';
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const filename = req.body?.filename;
  if (!content.trim()) return res.status(400).json({ error: 'Content is required' });
  if (!SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) return res.status(415).json({ error: 'Only TXT and Markdown content is supported' });
  if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_INGEST_BYTES) return res.status(413).json({ error: 'Content exceeds the 5 MB limit' });
  if (!hasSafeTextFilename(filename) || !isTextFilenameConsistent(filename, mimeType)) return res.status(400).json({ error: 'Filename is invalid for the supplied content type' });

  const result = await dataAccess.learningResources.ingestTextContent({
    resourceId: id,
    mimeType,
    content,
    createdBy: req.user?.id ?? 'system',
  });

  if (!result) return res.status(500).json({ error: 'Failed to ingest content' });
  res.status(201).json(result);
});

router.get('/learning-resources/:id/processing', requireAuth, requireRole('lecturer', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const resource = await dataAccess.learningResources.getById(id);
  if (!resource) return res.status(404).json({ error: 'Not found' });
  if (!(await assertCourseAuthorization(req, resource.courseId))) return res.status(403).json({ error: 'Forbidden' });
  const processing = await dataAccess.learningResources.getProcessing(id);
  if (!processing) return res.status(404).json({ error: 'No processing job found' });
  res.json(processing);
});

router.post('/learning-resources/:id/retry-processing', requireAuth, requireRole('lecturer', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const resource = await dataAccess.learningResources.getById(id);
  if (!resource) return res.status(404).json({ error: 'Not found' });
  if (!(await assertCourseAuthorization(req, resource.courseId))) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await retryStoredFile({ repository: dataAccess.learningResources, storage, resourceId: id });
    if (!result) return res.status(409).json({ error: 'No failed processing job is retryable' });
    res.status(200).json(await dataAccess.learningResources.getProcessing(id));
  } catch {
    res.status(422).json({ error: 'Content processing failed', processing: await dataAccess.learningResources.getProcessing(id) });
  }
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
