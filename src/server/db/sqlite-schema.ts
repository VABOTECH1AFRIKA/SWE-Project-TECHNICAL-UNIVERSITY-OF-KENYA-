import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('student'), // student | lecturer | admin
  avatar:       text('avatar').notNull().default(''),
  program:      text('program').default(''),
  year:         integer('year').default(1),
  department:   text('department').default(''),
  streak:       integer('streak').notNull().default(0),
  status:       text('status').notNull().default('active'),
  joined:       text('joined').notNull().default(sql`(date('now'))`),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ── Courses ───────────────────────────────────────────────────────────────────
export const courses = sqliteTable('courses', {
  id:               text('id').primaryKey(),
  code:             text('code').notNull().unique(),
  title:            text('title').notNull(),
  color:            text('color').notNull().default('#1F6F6B'),
  progress:         integer('progress').notNull().default(0),
  notesCount:       integer('notes_count').notNull().default(0),
  assignmentsCount: integer('assignments_count').notNull().default(0),
  icon:             text('icon').notNull().default('BookOpen'),
  lecturer:         text('lecturer').notNull().default(''),
});

// ── Notes ─────────────────────────────────────────────────────────────────────
export const notes = sqliteTable('notes', {
  id:     text('id').primaryKey(),
  title:  text('title').notNull(),
  course: text('course').notNull().references(() => courses.code),
  type:   text('type').notNull().default('pdf'),
  date:   text('date').notNull(),
  size:   text('size').notNull().default(''),
  pages:  integer('pages').notNull().default(0),
});

// ── Assignments ───────────────────────────────────────────────────────────────
export const assignments = sqliteTable('assignments', {
  id:       text('id').primaryKey(),
  title:    text('title').notNull(),
  course:   text('course').notNull().references(() => courses.code),
  dueDate:  text('due_date').notNull(),
  status:   text('status').notNull().default('pending'),
  grade:    real('grade'),
  maxGrade: real('max_grade').notNull().default(100),
  weight:   text('weight').notNull().default(''),
});

// ── Quizzes ───────────────────────────────────────────────────────────────────
export const quizzes = sqliteTable('quizzes', {
  id:            text('id').primaryKey(),
  title:         text('title').notNull(),
  course:        text('course').notNull().references(() => courses.code),
  difficulty:    text('difficulty').notNull().default('Medium'),
  questionCount: integer('question_count').notNull().default(0),
  duration:      integer('duration').notNull().default(10),
  bestScore:     real('best_score'),
  aiGenerated:   integer('ai_generated', { mode: 'boolean' }).notNull().default(false),
});

export const quizQuestions = sqliteTable('quiz_questions', {
  id:          text('id').primaryKey(),
  quizId:      text('quiz_id').notNull().references(() => quizzes.id),
  question:    text('question').notNull(),
  options:     text('options').notNull(), // JSON array
  correct:     integer('correct').notNull(),
  explanation: text('explanation').notNull().default(''),
  orderIdx:    integer('order_idx').notNull().default(0),
});

// ── Flashcards ────────────────────────────────────────────────────────────────
export const flashcards = sqliteTable('flashcards', {
  id:          text('id').primaryKey(),
  deck:        text('deck').notNull().references(() => courses.code),
  front:       text('front').notNull(),
  back:        text('back').notNull(),
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).notNull().default(false),
});

// ── Videos ────────────────────────────────────────────────────────────────────
export const videos = sqliteTable('videos', {
  id:          text('id').primaryKey(),
  title:       text('title').notNull(),
  channel:     text('channel').notNull(),
  thumbnail:   text('thumbnail').notNull().default(''),
  duration:    text('duration').notNull().default(''),
  views:       text('views').notNull().default(''),
  relevance:   integer('relevance').notNull().default(90),
  course:      text('course').notNull().references(() => courses.code),
  uploadedAgo: text('uploaded_ago').notNull().default(''),
});

// ── Study Plan ────────────────────────────────────────────────────────────────
export const studyPlan = sqliteTable('study_plan', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id),
  title:     text('title').notNull(),
  course:    text('course').notNull().references(() => courses.code),
  dueDate:   text('due_date').notNull(),
  time:      text('time').notNull().default('09:00'),
  duration:  integer('duration').notNull().default(60),
  type:      text('type').notNull().default('study'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

// ── Forum ─────────────────────────────────────────────────────────────────────
export const forumThreads = sqliteTable('forum_threads', {
  id:           text('id').primaryKey(),
  title:        text('title').notNull(),
  course:       text('course').notNull().references(() => courses.code),
  author:       text('author').notNull(),
  authorRole:   text('author_role').notNull().default('student'),
  views:        integer('views').notNull().default(0),
  tags:         text('tags').notNull().default('[]'), // JSON array
  solved:       integer('solved', { mode: 'boolean' }).notNull().default(false),
  lastActivity: text('last_activity').notNull().default(''),
  content:      text('content').notNull().default(''),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const forumReplies = sqliteTable('forum_replies', {
  id:         text('id').primaryKey(),
  threadId:   text('thread_id').notNull().references(() => forumThreads.id),
  author:     text('author').notNull(),
  authorRole: text('author_role').notNull().default('student'),
  content:    text('content').notNull(),
  timestamp:  text('timestamp').notNull().default(sql`(datetime('now'))`),
});

// ── Analytics (per-user snapshot) ─────────────────────────────────────────────
export const analyticsSnapshots = sqliteTable('analytics_snapshots', {
  id:               text('id').primaryKey(),
  userId:           text('user_id').notNull().references(() => users.id),
  overallGrade:     real('overall_grade').notNull().default(0),
  quizAverage:      real('quiz_average').notNull().default(0),
  studyHours:       integer('study_hours').notNull().default(0),
  assignmentsDone:  integer('assignments_done').notNull().default(0),
  assignmentsTotal: integer('assignments_total').notNull().default(0),
  dayStreak:        integer('day_streak').notNull().default(0),
  coursesActive:    integer('courses_active').notNull().default(0),
  weeklyProgress:   text('weekly_progress').notNull().default('[]'),   // JSON
  recentQuizScores: text('recent_quiz_scores').notNull().default('[]'), // JSON
  subjectStrengths: text('subject_strengths').notNull().default('[]'),  // JSON
  radarData:        text('radar_data').notNull().default('[]'),          // JSON
  updatedAt:        text('updated_at').notNull().default(sql`(datetime('now'))`),
});
