/**
 * StudyHub AI — Express fallback data routes
 * Served when the Python FastAPI backend is unreachable.
 * Mirrors every endpoint in python_api/main.py.
 */
import type { Request, Response } from 'express';
import express from 'express';

const router = express.Router();

// ── Seed data (mirrors python_api/main.py) ─────────────────────────────────

const COURSES = [
  { id: 'cs301', code: 'CS301', title: 'Data Structures & Algorithms', color: '#1F6F6B', progress: 72, notesCount: 12, assignmentsCount: 4, icon: 'Layers', lecturer: 'Dr. Sarah Mitchell' },
  { id: 'cs302', code: 'CS302', title: 'Database Management Systems', color: '#6FA37C', progress: 58, notesCount: 9, assignmentsCount: 3, icon: 'Database', lecturer: 'Prof. James Carter' },
  { id: 'cs303', code: 'CS303', title: 'Operating Systems', color: '#E85D42', progress: 45, notesCount: 7, assignmentsCount: 5, icon: 'Cpu', lecturer: 'Dr. Linda Park' },
  { id: 'cs304', code: 'CS304', title: 'Software Engineering', color: '#FFC94A', progress: 83, notesCount: 11, assignmentsCount: 2, icon: 'Code2', lecturer: 'Prof. Mark Davis' },
];

const NOTES = [
  { id: 'n1', title: 'Week 1 — Introduction to Trees', course: 'CS301', type: 'Lecture Slides', date: '2026-08-10', size: '2.4 MB', pages: 24 },
  { id: 'n2', title: 'Week 2 — Binary Search Trees', course: 'CS301', type: 'Lecture Notes', date: '2026-08-17', size: '1.8 MB', pages: 18 },
  { id: 'n3', title: 'Week 3 — Graph Algorithms', course: 'CS301', type: 'Lecture Slides', date: '2026-08-24', size: '3.1 MB', pages: 31 },
  { id: 'n4', title: 'ER Diagrams & Normalization', course: 'CS302', type: 'Lecture Notes', date: '2026-08-12', size: '2.0 MB', pages: 20 },
  { id: 'n5', title: 'SQL Advanced Queries', course: 'CS302', type: 'Lab Sheet', date: '2026-08-19', size: '0.9 MB', pages: 8 },
  { id: 'n6', title: 'Process Scheduling Algorithms', course: 'CS303', type: 'Lecture Slides', date: '2026-08-11', size: '2.7 MB', pages: 27 },
  { id: 'n7', title: 'Memory Management', course: 'CS303', type: 'Lecture Notes', date: '2026-08-18', size: '1.5 MB', pages: 15 },
  { id: 'n8', title: 'Agile & Scrum Methodology', course: 'CS304', type: 'Lecture Slides', date: '2026-08-20', size: '3.4 MB', pages: 34 },
];

const ASSIGNMENTS = [
  { id: 'a1', title: 'BST Implementation in Python', course: 'CS301', dueDate: '2026-08-28', status: 'submitted', grade: null, maxGrade: 100, weight: '15%' },
  { id: 'a2', title: 'Database Design Project', course: 'CS302', dueDate: '2026-09-05', status: 'pending', grade: null, maxGrade: 100, weight: '20%' },
  { id: 'a3', title: 'Process Scheduler Simulation', course: 'CS303', dueDate: '2026-08-20', status: 'overdue', grade: null, maxGrade: 100, weight: '15%' },
  { id: 'a4', title: 'Sprint Planning Document', course: 'CS304', dueDate: '2026-08-15', status: 'graded', grade: 87, maxGrade: 100, weight: '10%' },
  { id: 'a5', title: 'Graph Traversal Analysis', course: 'CS301', dueDate: '2026-09-10', status: 'pending', grade: null, maxGrade: 100, weight: '20%' },
];

const QUIZZES = [
  {
    id: 'q1', title: 'Binary Trees Fundamentals', course: 'CS301', difficulty: 'Medium',
    questionCount: 3, duration: 10, bestScore: 67, aiGenerated: true,
    questions: [
      { id: 'qq1', question: 'What is the time complexity of searching in a balanced BST?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correct: 1, explanation: 'In a balanced BST, each comparison eliminates half the remaining nodes.' },
      { id: 'qq2', question: 'Which traversal visits nodes in ascending order for a BST?', options: ['Pre-order', 'Post-order', 'In-order', 'Level-order'], correct: 2, explanation: 'In-order traversal (Left → Root → Right) visits BST nodes in ascending sorted order.' },
      { id: 'qq3', question: 'What is the maximum number of nodes in a binary tree of height h?', options: ['2h', '2h - 1', '2^(h+1) - 1', 'h^2'], correct: 2, explanation: 'A complete binary tree of height h has at most 2^(h+1) - 1 nodes.' },
    ],
  },
  { id: 'q2', title: 'SQL Joins & Subqueries', course: 'CS302', difficulty: 'Hard', questionCount: 10, duration: 20, bestScore: null, aiGenerated: true, questions: [] },
  { id: 'q3', title: 'Process Scheduling', course: 'CS303', difficulty: 'Easy', questionCount: 8, duration: 15, bestScore: null, aiGenerated: false, questions: [] },
  { id: 'q4', title: 'Agile Principles', course: 'CS304', difficulty: 'Easy', questionCount: 6, duration: 12, bestScore: 83, aiGenerated: false, questions: [] },
];

const FLASHCARDS = [
  { id: 'f1', deck: 'CS301', front: 'What is a Binary Search Tree (BST)?', back: 'A BST is a binary tree where for each node, all values in the left subtree are less than the node, and all values in the right subtree are greater.', aiGenerated: true },
  { id: 'f2', deck: 'CS301', front: 'What is the difference between BFS and DFS?', back: 'BFS explores level by level using a queue. DFS explores as deep as possible using a stack or recursion.', aiGenerated: true },
  { id: 'f3', deck: 'CS301', front: 'Define Big-O notation.', back: "Big-O notation describes the upper bound of an algorithm's time or space complexity in the worst case.", aiGenerated: false },
  { id: 'f4', deck: 'CS302', front: 'What is database normalization?', back: 'Normalization organizes a database to reduce redundancy and improve data integrity through normal forms (1NF, 2NF, 3NF, BCNF).', aiGenerated: true },
  { id: 'f5', deck: 'CS302', front: 'What is a foreign key?', back: 'A foreign key references the primary key of another table, establishing a relationship between the two tables.', aiGenerated: false },
  { id: 'f6', deck: 'CS303', front: 'What is a deadlock in operating systems?', back: 'A deadlock occurs when two or more processes are waiting for each other to release resources, creating a circular dependency.', aiGenerated: true },
];

const VIDEOS = [
  { id: 'v1', title: 'Binary Trees and BST — Complete Guide', channel: 'CS Dojo', thumbnail: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400&h=225&fit=crop', duration: '18:42', views: '1.2M', relevance: 98, course: 'CS301', uploadedAgo: '2 years ago' },
  { id: 'v2', title: 'Graph Algorithms: BFS and DFS Explained', channel: 'Abdul Bari', thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=225&fit=crop', duration: '24:15', views: '890K', relevance: 95, course: 'CS301', uploadedAgo: '3 years ago' },
  { id: 'v3', title: 'SQL Joins Explained with Examples', channel: 'Programming with Mosh', thumbnail: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=225&fit=crop', duration: '31:08', views: '2.1M', relevance: 97, course: 'CS302', uploadedAgo: '4 years ago' },
  { id: 'v4', title: 'Operating System Process Scheduling', channel: 'Neso Academy', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=225&fit=crop', duration: '22:30', views: '650K', relevance: 92, course: 'CS303', uploadedAgo: '2 years ago' },
  { id: 'v5', title: 'Agile & Scrum in 10 Minutes', channel: 'Fireship', thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=225&fit=crop', duration: '10:22', views: '3.4M', relevance: 89, course: 'CS304', uploadedAgo: '1 year ago' },
];

const STUDY_PLAN: Record<string, unknown>[] = [
  { id: 'sp1', title: 'Review BST lecture notes', course: 'CS301', dueDate: '2026-08-24', time: '09:00', duration: 60, type: 'study', completed: true },
  { id: 'sp2', title: 'Complete Database Design Project', course: 'CS302', dueDate: '2026-09-05', time: '14:00', duration: 120, type: 'assignment', completed: false },
  { id: 'sp3', title: 'Watch OS Scheduling video', course: 'CS303', dueDate: '2026-08-25', time: '11:00', duration: 30, type: 'video', completed: false },
  { id: 'sp4', title: 'Binary Trees quiz practice', course: 'CS301', dueDate: '2026-08-24', time: '16:00', duration: 20, type: 'quiz', completed: true },
  { id: 'sp5', title: 'Read Agile chapter 5', course: 'CS304', dueDate: '2026-08-26', time: '10:00', duration: 45, type: 'study', completed: false },
];

const ANALYTICS = {
  overallGrade: 78.4, quizAverage: 75.3, studyHours: 42,
  assignmentsDone: 3, assignmentsTotal: 7, dayStreak: 7, coursesActive: 4,
  weeklyProgress: [
    { day: 'Mon', hours: 2.5, score: 72 }, { day: 'Tue', hours: 3.0, score: 78 },
    { day: 'Wed', hours: 1.5, score: 65 }, { day: 'Thu', hours: 4.0, score: 85 },
    { day: 'Fri', hours: 2.0, score: 74 }, { day: 'Sat', hours: 3.5, score: 80 },
    { day: 'Sun', hours: 1.0, score: 70 },
  ],
  recentQuizScores: [
    { quiz: 'BST Quiz', score: 67, course: 'CS301' }, { quiz: 'SQL Basics', score: 82, course: 'CS302' },
    { quiz: 'Agile Principles', score: 83, course: 'CS304' }, { quiz: 'Sorting Algos', score: 71, course: 'CS301' },
    { quiz: 'ER Diagrams', score: 76, course: 'CS302' },
  ],
  subjectStrengths: [
    { subject: 'Data Structures', score: 78, status: 'average' }, { subject: 'Database Systems', score: 82, status: 'strong' },
    { subject: 'Operating Systems', score: 61, status: 'needs-work' }, { subject: 'Software Engineering', score: 88, status: 'strong' },
  ],
  radarData: [
    { subject: 'Algorithms', score: 75 }, { subject: 'Databases', score: 82 },
    { subject: 'OS Concepts', score: 61 }, { subject: 'SE Practices', score: 88 },
    { subject: 'Problem Solving', score: 79 }, { subject: 'Code Quality', score: 84 },
  ],
};

const FORUM_THREADS: Record<string, unknown>[] = [
  { id: 'ft1', title: 'How does AVL tree rotation work in practice?', course: 'CS301', author: 'Alex Johnson', authorRole: 'student', replies: 2, views: 42, tags: ['trees', 'avl', 'rotation'], solved: true, lastActivity: '2 hours ago', content: "I'm struggling to understand when and how AVL tree rotations are triggered.", replyList: [{ id: 'r1', author: 'Dr. Sarah Mitchell', authorRole: 'lecturer', content: 'AVL rotations are triggered when the balance factor becomes +2 or -2.', timestamp: '1 hour ago' }, { id: 'r2', author: 'Jamie Lee', authorRole: 'student', content: 'Think of it as rebalancing so no subtree is more than 1 level deeper.', timestamp: '45 min ago' }] },
  { id: 'ft2', title: 'Best practices for database indexing?', course: 'CS302', author: 'Priya Sharma', authorRole: 'student', replies: 1, views: 28, tags: ['indexing', 'performance', 'sql'], solved: false, lastActivity: '5 hours ago', content: 'When should we add indexes to a table?', replyList: [{ id: 'r3', author: 'Prof. James Carter', authorRole: 'lecturer', content: 'Indexes speed up reads but slow down writes.', timestamp: '4 hours ago' }] },
  { id: 'ft3', title: 'Confused about deadlock prevention vs avoidance', course: 'CS303', author: 'Marcus Chen', authorRole: 'student', replies: 0, views: 19, tags: ['deadlock', 'os', 'concurrency'], solved: false, lastActivity: '1 day ago', content: "What's the practical difference between deadlock prevention and deadlock avoidance?", replyList: [] },
  { id: 'ft4', title: "Sprint retrospective vs sprint review — what's the difference?", course: 'CS304', author: 'Sofia Reyes', authorRole: 'student', replies: 1, views: 35, tags: ['agile', 'scrum', 'sprint'], solved: true, lastActivity: '3 hours ago', content: 'I keep mixing these up in my notes.', replyList: [{ id: 'r4', author: 'Prof. Mark Davis', authorRole: 'lecturer', content: 'Sprint Review: demo to stakeholders. Sprint Retrospective: team-only process reflection.', timestamp: '2 hours ago' }] },
  { id: 'ft5', title: 'Study group for CS301 midterm?', course: 'CS301', author: 'Tom Williams', authorRole: 'student', replies: 0, views: 67, tags: ['study-group', 'midterm'], solved: false, lastActivity: '30 min ago', content: 'Anyone interested in forming a study group for the CS301 midterm next week?', replyList: [] },
];

const NOTIFICATIONS = [
  { id: 'notif1', type: 'assignment', message: 'Assignment "Process Scheduler Simulation" is overdue', time: '2 hours ago', read: false, urgent: true },
  { id: 'notif2', type: 'grade', message: 'Your Sprint Planning Document has been graded: 87/100', time: '1 day ago', read: false, urgent: false },
  { id: 'notif3', type: 'forum', message: 'Dr. Mitchell replied to your forum post', time: '1 hour ago', read: false, urgent: false },
  { id: 'notif4', type: 'quiz', message: 'New AI-generated quiz available: SQL Joins & Subqueries', time: '3 hours ago', read: true, urgent: false },
  { id: 'notif5', type: 'note', message: 'New lecture notes uploaded for CS301: Week 3 Graph Algorithms', time: '5 hours ago', read: true, urgent: false },
];

const ADMIN_STATS = { totalStudents: 1247, lecturers: 48, courses: 92, activeUsers: 834, notesUploaded: 1563, quizzesTaken: 12480 };

const ADMIN_USERS: Record<string, unknown>[] = [
  { id: 'au1', name: 'Alex Johnson', email: 'alex.johnson@tuk.ac.ke', role: 'student', status: 'active', joined: '2024-09-01', avatar: 'AJ' },
  { id: 'au2', name: 'Dr. Sarah Mitchell', email: 'sarah.mitchell@tuk.ac.ke', role: 'lecturer', status: 'active', joined: '2022-01-15', avatar: 'SM' },
  { id: 'au3', name: 'Priya Sharma', email: 'priya.sharma@tuk.ac.ke', role: 'student', status: 'active', joined: '2024-09-01', avatar: 'PS' },
  { id: 'au4', name: 'Prof. James Carter', email: 'james.carter@tuk.ac.ke', role: 'lecturer', status: 'suspended', joined: '2020-08-20', avatar: 'JC' },
  { id: 'au5', name: 'Marcus Chen', email: 'marcus.chen@tuk.ac.ke', role: 'student', status: 'active', joined: '2025-01-10', avatar: 'MC' },
];

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/courses', (_req, res) => res.json(COURSES));
router.get('/courses/:id', (req, res) => {
  const c = COURSES.find((x) => x.id === req.params.id || x.code === req.params.id.toUpperCase());
  c ? res.json(c) : res.status(404).json({ error: 'Not found' });
});

router.get('/notes', (req, res) => {
  const { course } = req.query as { course?: string };
  res.json(course ? NOTES.filter((n) => n.course === course.toUpperCase()) : NOTES);
});

router.get('/assignments', (req, res) => {
  const { course } = req.query as { course?: string };
  res.json(course ? ASSIGNMENTS.filter((a) => a.course === course.toUpperCase()) : ASSIGNMENTS);
});

router.get('/quizzes', (req, res) => {
  const { course } = req.query as { course?: string };
  res.json(course ? QUIZZES.filter((q) => q.course === course.toUpperCase()) : QUIZZES);
});
router.get('/quizzes/:id', (req, res) => {
  const q = QUIZZES.find((x) => x.id === req.params.id);
  q ? res.json(q) : res.status(404).json({ error: 'Not found' });
});

router.get('/flashcards', (req, res) => {
  const { deck } = req.query as { deck?: string };
  res.json(deck ? FLASHCARDS.filter((f) => f.deck === deck.toUpperCase()) : FLASHCARDS);
});

router.get('/videos', (req, res) => {
  const { course } = req.query as { course?: string };
  res.json(course ? VIDEOS.filter((v) => v.course === course.toUpperCase()) : VIDEOS);
});

router.get('/study-plan', (_req, res) => res.json(STUDY_PLAN));
router.post('/study-plan', (req: Request, res: Response) => {
  const task = { id: `sp${Date.now()}`, ...req.body, completed: false };
  STUDY_PLAN.push(task);
  res.status(201).json(task);
});
router.patch('/study-plan/:id/toggle', (req, res) => {
  const task = STUDY_PLAN.find((t) => t.id === req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.completed = !task.completed;
  res.json(task);
});

router.get('/analytics', (_req, res) => res.json(ANALYTICS));

router.get('/forum', (req, res) => {
  const { course } = req.query as { course?: string };
  res.json(course ? FORUM_THREADS.filter((t) => (t as { course: string }).course === course.toUpperCase()) : FORUM_THREADS);
});
router.get('/forum/:id', (req, res) => {
  const t = FORUM_THREADS.find((x) => (x as { id: string }).id === req.params.id);
  t ? res.json(t) : res.status(404).json({ error: 'Not found' });
});
router.post('/forum', (req: Request, res: Response) => {
  const thread = { id: `ft${Date.now()}`, ...req.body, replies: 0, views: 0, solved: false, lastActivity: 'just now', replyList: [] };
  FORUM_THREADS.push(thread);
  res.status(201).json(thread);
});
router.post('/forum/:id/replies', (req: Request, res: Response) => {
  const thread = FORUM_THREADS.find((t) => (t as { id: string }).id === req.params.id) as Record<string, unknown> | undefined;
  if (!thread) return res.status(404).json({ error: 'Not found' });
  const reply = { id: `r${Date.now()}`, ...req.body, timestamp: 'just now' };
  (thread.replyList as unknown[]).push(reply);
  thread.replies = (thread.replyList as unknown[]).length;
  thread.lastActivity = 'just now';
  res.status(201).json(reply);
});

router.get('/notifications', (_req, res) => res.json(NOTIFICATIONS));
router.patch('/notifications/:id/read', (req, res) => {
  const n = NOTIFICATIONS.find((x) => x.id === req.params.id) as Record<string, unknown> | undefined;
  if (!n) return res.status(404).json({ error: 'Not found' });
  n.read = true;
  res.json(n);
});

router.get('/admin/stats', (_req, res) => res.json(ADMIN_STATS));
router.get('/admin/users', (req, res) => {
  const { search } = req.query as { search?: string };
  if (search) {
    const s = search.toLowerCase();
    return res.json(ADMIN_USERS.filter((u) => {
      const user = u as { name: string; email: string };
      return user.name.toLowerCase().includes(s) || user.email.toLowerCase().includes(s);
    }));
  }
  res.json(ADMIN_USERS);
});
router.patch('/admin/users/:id/status', (req: Request, res: Response) => {
  const user = ADMIN_USERS.find((u) => (u as { id: string }).id === req.params.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.status = req.body.status;
  res.json(user);
});

router.post('/auth/login', (req: Request, res: Response) => {
  const { email = '' } = req.body as { email?: string };
  const isLecturer = ['mitchell', 'carter', 'park', 'davis'].some((n) => email.includes(n));
  const isAdmin = email.includes('admin');
  const user = isAdmin
    ? { id: 'a1', name: 'Admin User', email, avatar: 'AU', role: 'admin' }
    : isLecturer
    ? { id: 'l1', name: 'Dr. Sarah Mitchell', email, avatar: 'SM', role: 'lecturer', department: 'Computer Science Department' }
    : { id: 'u1', name: 'Alex Johnson', email, avatar: 'AJ', role: 'student', streak: 7, program: 'BSc Computer Science', year: 3 };
  res.json({ token: `mock-token-${user.role}`, user });
});

router.post('/auth/register', (_req: Request, res: Response) => {
  res.status(201).json({ token: 'mock-token-student', user: { id: 'u1', name: 'Alex Johnson', email: 'alex@tuk.ac.ke', avatar: 'AJ', role: 'student', streak: 0, program: 'BSc Computer Science', year: 1 } });
});

export default router;
