/**
 * Run once to create all tables and seed initial data.
 * Usage: npx tsx src/server/db/migrate-and-seed.ts
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import path from 'path';
import * as schema from './sqlite-schema.js';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join('/private', 'studyhub.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
void schema; // schema imported for type reference only

// ── DDL ───────────────────────────────────────────────────────────────────────
sqlite.exec(`
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
  joined TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  date TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  pages INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL REFERENCES courses(code),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  grade REAL,
  max_grade REAL NOT NULL DEFAULT 100,
  weight TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL REFERENCES courses(code),
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  question_count INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 10,
  best_score REAL,
  ai_generated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  order_idx INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  deck TEXT NOT NULL REFERENCES courses(code),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 0
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
  due_date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '09:00',
  duration INTEGER NOT NULL DEFAULT 60,
  type TEXT NOT NULL DEFAULT 'study',
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL REFERENCES courses(code),
  author TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'student',
  views INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  solved INTEGER NOT NULL DEFAULT 0,
  last_activity TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES forum_threads(id),
  author TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'student',
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  overall_grade REAL NOT NULL DEFAULT 0,
  quiz_average REAL NOT NULL DEFAULT 0,
  study_hours INTEGER NOT NULL DEFAULT 0,
  assignments_done INTEGER NOT NULL DEFAULT 0,
  assignments_total INTEGER NOT NULL DEFAULT 0,
  day_streak INTEGER NOT NULL DEFAULT 0,
  courses_active INTEGER NOT NULL DEFAULT 0,
  weekly_progress TEXT NOT NULL DEFAULT '[]',
  recent_quiz_scores TEXT NOT NULL DEFAULT '[]',
  subject_strengths TEXT NOT NULL DEFAULT '[]',
  radar_data TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  checksum TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  storage_reference TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'not_started',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  superseded_at TEXT,
  published_at TEXT,
  UNIQUE (resource_id, version_number)
);

CREATE TABLE IF NOT EXISTS content_processing_jobs (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'text_extraction',
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TEXT,
  finished_at TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (version_id, ordinal)
);

CREATE TABLE IF NOT EXISTS tutor_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  topic TEXT,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES tutor_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
`);

console.log('✅ Tables created');

// ── Seed helpers ──────────────────────────────────────────────────────────────
function upsertUser(u: typeof schema.users.$inferInsert) {
  sqlite.prepare(`
    INSERT INTO users (id,name,email,password_hash,role,avatar,program,year,department,streak,status,joined)
    VALUES (@id,@name,@email,@passwordHash,@role,@avatar,@program,@year,@department,@streak,@status,@joined)
    ON CONFLICT(id) DO NOTHING
  `).run(u);
}

function upsertCourse(c: typeof schema.courses.$inferInsert) {
  sqlite.prepare(`
    INSERT INTO courses (id,code,title,color,progress,notes_count,assignments_count,icon,lecturer)
    VALUES (@id,@code,@title,@color,@progress,@notesCount,@assignmentsCount,@icon,@lecturer)
    ON CONFLICT(id) DO NOTHING
  `).run(c);
}

// ── Seed users ────────────────────────────────────────────────────────────────
const hash = (pw: string) => bcrypt.hashSync(pw, 10);

upsertUser({ id: 'u1', name: 'Alex Johnson', email: 'student@studyhub.ai', passwordHash: hash('student123'), role: 'student', avatar: 'AJ', program: 'Computer Science', year: 2, department: '', streak: 7, status: 'active', joined: '2025-09-01' });
upsertUser({ id: 'u2', name: 'Dr. Sarah Mitchell', email: 'lecturer@studyhub.ai', passwordHash: hash('lecturer123'), role: 'lecturer', avatar: 'SM', program: '', year: 0, department: 'Computer Science', streak: 0, status: 'active', joined: '2020-01-15' });
upsertUser({ id: 'u3', name: 'Admin User', email: 'admin@studyhub.ai', passwordHash: hash('admin123'), role: 'admin', avatar: 'AU', program: '', year: 0, department: 'IT', streak: 0, status: 'active', joined: '2019-06-01' });
upsertUser({ id: 'u4', name: 'Maria Garcia', email: 'maria@studyhub.ai', passwordHash: hash('student123'), role: 'student', avatar: 'MG', program: 'Data Science', year: 3, department: '', streak: 12, status: 'active', joined: '2024-09-01' });
upsertUser({ id: 'u5', name: 'James Carter', email: 'james@studyhub.ai', passwordHash: hash('student123'), role: 'student', avatar: 'JC', program: 'Software Engineering', year: 1, department: '', streak: 3, status: 'suspended', joined: '2026-01-10' });

console.log('✅ Users seeded');

// ── Seed courses ──────────────────────────────────────────────────────────────
const courseData = [
  { id: 'cs301', code: 'CS301', title: 'Data Structures & Algorithms', color: '#1F6F6B', progress: 72, notesCount: 12, assignmentsCount: 4, icon: 'Layers', lecturer: 'Dr. Sarah Mitchell' },
  { id: 'cs302', code: 'CS302', title: 'Database Management Systems', color: '#6FA37C', progress: 58, notesCount: 9, assignmentsCount: 3, icon: 'Database', lecturer: 'Prof. James Carter' },
  { id: 'cs303', code: 'CS303', title: 'Operating Systems', color: '#E85D42', progress: 45, notesCount: 7, assignmentsCount: 5, icon: 'Cpu', lecturer: 'Dr. Emily Chen' },
  { id: 'cs304', code: 'CS304', title: 'Computer Networks', color: '#FFC94A', progress: 63, notesCount: 10, assignmentsCount: 3, icon: 'Network', lecturer: 'Prof. Michael Brown' },
];
courseData.forEach(upsertCourse);

const courseMembershipData = [
  { userId: 'u1', courseId: 'cs301', role: 'student', status: 'active' },
  { userId: 'u1', courseId: 'cs302', role: 'student', status: 'active' },
  { userId: 'u2', courseId: 'cs301', role: 'lecturer', status: 'active' },
  { userId: 'u2', courseId: 'cs302', role: 'lecturer', status: 'active' },
  { userId: 'u3', courseId: 'cs301', role: 'admin', status: 'active' },
  { userId: 'u3', courseId: 'cs302', role: 'admin', status: 'active' },
  { userId: 'u4', courseId: 'cs302', role: 'student', status: 'active' },
];

courseMembershipData.forEach((membership) => {
  sqlite.prepare(`INSERT INTO course_memberships (id,user_id,course_id,role,status,created_at,updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, course_id) DO NOTHING`)
    .run(`cm${randomUUID().slice(0, 8)}`, membership.userId, membership.courseId, membership.role, membership.status);
});
console.log('✅ Courses seeded');

// ── Seed notes ────────────────────────────────────────────────────────────────
const notesData = [
  { id: 'n1', title: 'Binary Trees & BST', course: 'CS301', type: 'pdf', date: '2026-08-10', size: '2.4 MB', pages: 18 },
  { id: 'n2', title: 'Sorting Algorithms', course: 'CS301', type: 'slides', date: '2026-08-15', size: '1.1 MB', pages: 32 },
  { id: 'n3', title: 'Graph Theory Basics', course: 'CS301', type: 'pdf', date: '2026-08-18', size: '3.2 MB', pages: 24 },
  { id: 'n4', title: 'SQL Fundamentals', course: 'CS302', type: 'pdf', date: '2026-08-12', size: '1.8 MB', pages: 20 },
  { id: 'n5', title: 'ER Diagrams & Normalization', course: 'CS302', type: 'slides', date: '2026-08-17', size: '900 KB', pages: 28 },
  { id: 'n6', title: 'Process Scheduling', course: 'CS303', type: 'pdf', date: '2026-08-14', size: '2.1 MB', pages: 16 },
  { id: 'n7', title: 'Memory Management', course: 'CS303', type: 'slides', date: '2026-08-20', size: '1.5 MB', pages: 22 },
  { id: 'n8', title: 'TCP/IP Protocol Suite', course: 'CS304', type: 'pdf', date: '2026-08-16', size: '2.8 MB', pages: 30 },
];
notesData.forEach((n) => {
  sqlite.prepare(`INSERT INTO notes (id,title,course,type,date,size,pages) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(n.id, n.title, n.course, n.type, n.date, n.size, n.pages);
});
console.log('✅ Notes seeded');

// ── Seed assignments ──────────────────────────────────────────────────────────
const assignmentsData = [
  { id: 'a1', title: 'BST Implementation', course: 'CS301', dueDate: '2026-09-05', status: 'submitted', grade: 88, maxGrade: 100, weight: '15%' },
  { id: 'a2', title: 'Sorting Benchmark Report', course: 'CS301', dueDate: '2026-09-20', status: 'pending', grade: null, maxGrade: 100, weight: '20%' },
  { id: 'a3', title: 'Database Design Project', course: 'CS302', dueDate: '2026-09-10', status: 'in-progress', grade: null, maxGrade: 100, weight: '25%' },
  { id: 'a4', title: 'SQL Query Optimization', course: 'CS302', dueDate: '2026-09-25', status: 'pending', grade: null, maxGrade: 100, weight: '15%' },
  { id: 'a5', title: 'Process Scheduler Simulation', course: 'CS303', dueDate: '2026-09-15', status: 'submitted', grade: 76, maxGrade: 100, weight: '20%' },
];
assignmentsData.forEach((a) => {
  sqlite.prepare(`INSERT INTO assignments (id,title,course,due_date,status,grade,max_grade,weight) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(a.id, a.title, a.course, a.dueDate, a.status, a.grade ?? null, a.maxGrade, a.weight);
});
console.log('✅ Assignments seeded');

// ── Seed quizzes + questions ──────────────────────────────────────────────────
const quizzesData = [
  {
    id: 'q1', title: 'Binary Trees Fundamentals', course: 'CS301', difficulty: 'Medium',
    questionCount: 3, duration: 10, bestScore: 67, aiGenerated: true,
    questions: [
      { id: 'qq1', question: 'What is the time complexity of searching in a balanced BST?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correct: 1, explanation: 'In a balanced BST, each comparison eliminates half the remaining nodes.' },
      { id: 'qq2', question: 'Which traversal visits nodes in ascending order for a BST?', options: ['Pre-order', 'Post-order', 'In-order', 'Level-order'], correct: 2, explanation: 'In-order traversal (left, root, right) visits BST nodes in sorted ascending order.' },
      { id: 'qq3', question: 'What is the maximum number of nodes in a binary tree of height h?', options: ['2h', '2h - 1', '2^h - 1', '2^(h+1) - 1'], correct: 3, explanation: 'A complete binary tree of height h has at most 2^(h+1) - 1 nodes.' },
    ],
  },
  {
    id: 'q2', title: 'SQL Queries & Joins', course: 'CS302', difficulty: 'Easy',
    questionCount: 3, duration: 8, bestScore: 100, aiGenerated: true,
    questions: [
      { id: 'qq4', question: 'Which SQL clause is used to filter rows?', options: ['ORDER BY', 'GROUP BY', 'WHERE', 'HAVING'], correct: 2, explanation: 'WHERE filters individual rows before grouping.' },
      { id: 'qq5', question: 'What does INNER JOIN return?', options: ['All rows from left table', 'All rows from right table', 'Matching rows from both tables', 'All rows from both tables'], correct: 2, explanation: 'INNER JOIN returns only rows where the join condition is met in both tables.' },
      { id: 'qq6', question: 'Which normal form eliminates transitive dependencies?', options: ['1NF', '2NF', '3NF', 'BCNF'], correct: 2, explanation: '3NF removes transitive dependencies where non-key attributes depend on other non-key attributes.' },
    ],
  },
  {
    id: 'q3', title: 'Process Scheduling', course: 'CS303', difficulty: 'Hard',
    questionCount: 3, duration: 12, bestScore: null, aiGenerated: false,
    questions: [
      { id: 'qq7', question: 'Which scheduling algorithm can cause starvation?', options: ['Round Robin', 'FCFS', 'Priority Scheduling', 'SJF'], correct: 2, explanation: 'Priority Scheduling can starve low-priority processes if high-priority ones keep arriving.' },
      { id: 'qq8', question: 'What is the main advantage of Round Robin scheduling?', options: ['Minimizes waiting time', 'Ensures fairness', 'Maximizes CPU utilization', 'Reduces context switches'], correct: 1, explanation: 'Round Robin gives each process an equal time slice, ensuring fair CPU distribution.' },
      { id: 'qq9', question: 'In SJF scheduling, what information is required?', options: ['Process priority', 'Burst time', 'Arrival time', 'Memory size'], correct: 1, explanation: 'SJF (Shortest Job First) requires knowing the CPU burst time of each process.' },
    ],
  },
  {
    id: 'q4', title: 'Network Protocols', course: 'CS304', difficulty: 'Medium',
    questionCount: 3, duration: 10, bestScore: null, aiGenerated: true,
    questions: [
      { id: 'qq10', question: 'At which OSI layer does TCP operate?', options: ['Network', 'Transport', 'Session', 'Application'], correct: 1, explanation: 'TCP operates at the Transport layer (Layer 4) of the OSI model.' },
      { id: 'qq11', question: 'What does DNS stand for?', options: ['Dynamic Network Service', 'Domain Name System', 'Data Network Standard', 'Distributed Node Service'], correct: 1, explanation: 'DNS (Domain Name System) translates human-readable domain names to IP addresses.' },
      { id: 'qq12', question: 'Which protocol is connectionless?', options: ['TCP', 'HTTP', 'UDP', 'FTP'], correct: 2, explanation: 'UDP (User Datagram Protocol) is connectionless — it sends packets without establishing a connection.' },
    ],
  },
];

quizzesData.forEach((q) => {
  sqlite.prepare(`INSERT INTO quizzes (id,title,course,difficulty,question_count,duration,best_score,ai_generated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(q.id, q.title, q.course, q.difficulty, q.questionCount, q.duration, q.bestScore ?? null, q.aiGenerated ? 1 : 0);
  q.questions.forEach((qq, i) => {
    sqlite.prepare(`INSERT INTO quiz_questions (id,quiz_id,question,options,correct,explanation,order_idx) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .run(qq.id, q.id, qq.question, JSON.stringify(qq.options), qq.correct, qq.explanation, i);
  });
});
console.log('✅ Quizzes seeded');

// ── Seed flashcards ───────────────────────────────────────────────────────────
const flashcardsData = [
  { id: 'f1', deck: 'CS301', front: 'What is a Binary Search Tree?', back: 'A BST is a binary tree where each node\'s left subtree contains only nodes with keys less than the node\'s key, and the right subtree only nodes with greater keys.', aiGenerated: true },
  { id: 'f2', deck: 'CS301', front: 'What is Big O notation?', back: 'Big O notation describes the upper bound of an algorithm\'s time or space complexity, expressing how performance scales with input size.', aiGenerated: true },
  { id: 'f3', deck: 'CS301', front: 'What is a Hash Table?', back: 'A data structure that maps keys to values using a hash function, providing O(1) average-case lookup, insertion, and deletion.', aiGenerated: false },
  { id: 'f4', deck: 'CS302', front: 'What is a Primary Key?', back: 'A primary key is a column (or set of columns) that uniquely identifies each row in a database table. It cannot be NULL.', aiGenerated: true },
  { id: 'f5', deck: 'CS302', front: 'What is database normalization?', back: 'The process of organizing a database to reduce redundancy and improve data integrity by dividing large tables into smaller ones and defining relationships.', aiGenerated: true },
  { id: 'f6', deck: 'CS303', front: 'What is a deadlock?', back: 'A deadlock occurs when two or more processes are blocked, each waiting for a resource held by another, creating a circular dependency.', aiGenerated: true },
  { id: 'f7', deck: 'CS303', front: 'What is virtual memory?', back: 'Virtual memory is a memory management technique that gives processes the illusion of a large, contiguous address space by using disk storage as an extension of RAM.', aiGenerated: false },
  { id: 'f8', deck: 'CS304', front: 'What is the difference between TCP and UDP?', back: 'TCP is connection-oriented, reliable, and ordered. UDP is connectionless, faster, but unreliable. TCP is used for web/email; UDP for streaming/gaming.', aiGenerated: true },
];
flashcardsData.forEach((f) => {
  sqlite.prepare(`INSERT INTO flashcards (id,deck,front,back,ai_generated) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(f.id, f.deck, f.front, f.back, f.aiGenerated ? 1 : 0);
});
console.log('✅ Flashcards seeded');

// ── Seed videos ───────────────────────────────────────────────────────────────
const videosData = [
  { id: 'v1', title: 'Binary Search Trees - Full Course', channel: 'CS Dojo', thumbnail: '', duration: '45:22', views: '1.2M', relevance: 98, course: 'CS301', uploadedAgo: '2 years ago' },
  { id: 'v2', title: 'Sorting Algorithms Visualized', channel: 'Reducible', thumbnail: '', duration: '28:14', views: '890K', relevance: 95, course: 'CS301', uploadedAgo: '1 year ago' },
  { id: 'v3', title: 'SQL Tutorial for Beginners', channel: 'Programming with Mosh', thumbnail: '', duration: '3:10:00', views: '5.4M', relevance: 97, course: 'CS302', uploadedAgo: '3 years ago' },
  { id: 'v4', title: 'Database Normalization Explained', channel: 'Decomplexify', thumbnail: '', duration: '22:45', views: '340K', relevance: 93, course: 'CS302', uploadedAgo: '8 months ago' },
  { id: 'v5', title: 'Operating Systems: CPU Scheduling', channel: 'Neso Academy', thumbnail: '', duration: '18:30', views: '620K', relevance: 96, course: 'CS303', uploadedAgo: '2 years ago' },
  { id: 'v6', title: 'Computer Networking Full Course', channel: 'freeCodeCamp', thumbnail: '', duration: '9:25:00', views: '2.1M', relevance: 94, course: 'CS304', uploadedAgo: '1 year ago' },
];
videosData.forEach((v) => {
  sqlite.prepare(`INSERT INTO videos (id,title,channel,thumbnail,duration,views,relevance,course,uploaded_ago) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(v.id, v.title, v.channel, v.thumbnail, v.duration, v.views, v.relevance, v.course, v.uploadedAgo);
});
console.log('✅ Videos seeded');

// ── Seed study plan ───────────────────────────────────────────────────────────
const studyPlanData = [
  { id: 'sp1', userId: 'u1', title: 'Review BST lecture notes', course: 'CS301', dueDate: '2026-08-24', time: '09:00', duration: 60, type: 'study', completed: true },
  { id: 'sp2', userId: 'u1', title: 'Complete Database Design Project', course: 'CS302', dueDate: '2026-09-05', time: '14:00', duration: 120, type: 'assignment', completed: false },
  { id: 'sp3', userId: 'u1', title: 'Watch OS Scheduling video', course: 'CS303', dueDate: '2026-08-25', time: '11:00', duration: 30, type: 'video', completed: false },
  { id: 'sp4', userId: 'u1', title: 'Binary Trees quiz practice', course: 'CS301', dueDate: '2026-08-26', time: '16:00', duration: 45, type: 'quiz', completed: false },
  { id: 'sp5', userId: 'u1', title: 'Read TCP/IP chapter', course: 'CS304', dueDate: '2026-08-27', time: '10:00', duration: 90, type: 'study', completed: false },
];
studyPlanData.forEach((s) => {
  sqlite.prepare(`INSERT INTO study_plan (id,user_id,title,course,due_date,time,duration,type,completed) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(s.id, s.userId, s.title, s.course, s.dueDate, s.time, s.duration, s.type, s.completed ? 1 : 0);
});
console.log('✅ Study plan seeded');

// ── Seed forum ────────────────────────────────────────────────────────────────
const threadsData = [
  { id: 'ft1', title: 'How does AVL tree rotation work in practice?', course: 'CS301', author: 'Alex Johnson', authorRole: 'student', views: 42, tags: '["trees","avl","rotation"]', solved: true, lastActivity: '2 hours ago', content: "I'm struggling to understand when and how AVL tree rotations are triggered." },
  { id: 'ft2', title: 'Difference between 2NF and 3NF?', course: 'CS302', author: 'Maria Garcia', authorRole: 'student', views: 28, tags: '["normalization","2nf","3nf"]', solved: false, lastActivity: '5 hours ago', content: 'Can someone explain the practical difference between 2NF and 3NF with an example?' },
  { id: 'ft3', title: 'Why does Round Robin cause more context switches?', course: 'CS303', author: 'Alex Johnson', authorRole: 'student', views: 19, tags: '["scheduling","round-robin"]', solved: false, lastActivity: '1 day ago', content: 'I understand Round Robin is fair, but why does it cause more context switches than FCFS?' },
];
threadsData.forEach((t) => {
  sqlite.prepare(`INSERT INTO forum_threads (id,title,course,author,author_role,views,tags,solved,last_activity,content) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(t.id, t.title, t.course, t.author, t.authorRole, t.views, t.tags, t.solved ? 1 : 0, t.lastActivity, t.content);
});

const repliesData = [
  { id: 'r1', threadId: 'ft1', author: 'Dr. Sarah Mitchell', authorRole: 'lecturer', content: 'AVL rotations are triggered when the balance factor becomes +2 or -2.', timestamp: '1 hour ago' },
  { id: 'r2', threadId: 'ft1', author: 'Maria Garcia', authorRole: 'student', content: 'Great explanation! So a single rotation handles LL and RR cases?', timestamp: '30 min ago' },
  { id: 'r3', threadId: 'ft2', author: 'Prof. James Carter', authorRole: 'lecturer', content: '2NF removes partial dependencies; 3NF additionally removes transitive dependencies.', timestamp: '4 hours ago' },
];
repliesData.forEach((r) => {
  sqlite.prepare(`INSERT INTO forum_replies (id,thread_id,author,author_role,content,timestamp) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .run(r.id, r.threadId, r.author, r.authorRole, r.content, r.timestamp);
});
console.log('✅ Forum seeded');

// ── Seed analytics ────────────────────────────────────────────────────────────
const analyticsData = {
  id: 'an1', userId: 'u1',
  overallGrade: 78.4, quizAverage: 75.3, studyHours: 42,
  assignmentsDone: 3, assignmentsTotal: 7, dayStreak: 7, coursesActive: 4,
  weeklyProgress: JSON.stringify([
    { day: 'Mon', hours: 2.5, score: 72 }, { day: 'Tue', hours: 3, score: 78 },
    { day: 'Wed', hours: 1.5, score: 65 }, { day: 'Thu', hours: 4, score: 85 },
    { day: 'Fri', hours: 2, score: 74 }, { day: 'Sat', hours: 3.5, score: 80 },
    { day: 'Sun', hours: 1, score: 70 },
  ]),
  recentQuizScores: JSON.stringify([
    { quiz: 'BST Quiz', score: 67, course: 'CS301' },
    { quiz: 'SQL Basics', score: 82, course: 'CS302' },
    { quiz: 'Process Scheduling', score: 71, course: 'CS303' },
    { quiz: 'Network Protocols', score: 88, course: 'CS304' },
  ]),
  subjectStrengths: JSON.stringify([
    { subject: 'CS301 - DSA', score: 72, status: 'good' },
    { subject: 'CS302 - DBMS', score: 85, status: 'excellent' },
    { subject: 'CS303 - OS', score: 61, status: 'needs-work' },
    { subject: 'CS304 - Networks', score: 78, status: 'good' },
  ]),
  radarData: JSON.stringify([
    { subject: 'DSA', score: 72 }, { subject: 'DBMS', score: 85 },
    { subject: 'OS', score: 61 }, { subject: 'Networks', score: 78 },
    { subject: 'Quizzes', score: 75 }, { subject: 'Assignments', score: 80 },
  ]),
};
sqlite.prepare(`
  INSERT INTO analytics_snapshots (id,user_id,overall_grade,quiz_average,study_hours,assignments_done,assignments_total,day_streak,courses_active,weekly_progress,recent_quiz_scores,subject_strengths,radar_data)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING
`).run(
  analyticsData.id, analyticsData.userId, analyticsData.overallGrade, analyticsData.quizAverage,
  analyticsData.studyHours, analyticsData.assignmentsDone, analyticsData.assignmentsTotal,
  analyticsData.dayStreak, analyticsData.coursesActive, analyticsData.weeklyProgress,
  analyticsData.recentQuizScores, analyticsData.subjectStrengths, analyticsData.radarData,
);
console.log('✅ Analytics seeded');

console.log('\n🎉 Database ready at', DB_PATH);
sqlite.close();
