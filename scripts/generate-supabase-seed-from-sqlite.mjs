import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const root = process.cwd();
const dbPath = process.env.DB_PATH || path.join(root, 'studyhub.db');
const outputPath = path.join(root, 'supabase', 'migrations', '002_seed_sqlite_data.sql');

const db = new Database(dbPath, { readonly: true });

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonbString(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function tableRows(name) {
  return db.prepare(`SELECT * FROM ${name} ORDER BY id`).all();
}

function appendInsert(lines, table, columns, rows, transforms = {}) {
  for (const row of rows) {
    const values = columns.map((column) => {
      const transform = transforms[column];
      const value = transform ? transform(row[column], row) : row[column];
      if (value === undefined) return 'DEFAULT';
      if (value === null) return 'NULL';
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (typeof value === 'number') return String(value);
      if (column === 'options' || column === 'tags' || column === 'weekly_progress' || column === 'recent_quiz_scores' || column === 'subject_strengths' || column === 'radar_data') {
        return sqlString(JSON.stringify(value)) + '::jsonb';
      }
      if (column === 'created_at' || column === 'updated_at' || column === 'timestamp' || column === 'expires_at' || column === 'joined') {
        if (String(value).startsWith('now') || String(value).startsWith('datetime(') || String(value).startsWith('date(')) {
          return value;
        }
      }
      return sqlString(value);
    });

    lines.push(`INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${columns.map((column) => `${column}=EXCLUDED.${column}`).join(', ')};`);
  }
}

const lines = [];
lines.push('-- Generated from SQLite source database: ' + dbPath);
lines.push('-- This file is for manual/controlled data migration into the verified Supabase schema.');
lines.push('');

const users = tableRows('users');
appendInsert(lines, 'users', ['id', 'name', 'email', 'password_hash', 'role', 'avatar', 'program', 'year', 'department', 'streak', 'status', 'joined'], users, {
  created_at: () => 'NOW()',
});

const courses = tableRows('courses');
appendInsert(lines, 'courses', ['id', 'code', 'title', 'color', 'progress', 'notes_count', 'assignments_count', 'icon', 'lecturer'], courses);

const notes = tableRows('notes');
appendInsert(lines, 'notes', ['id', 'title', 'course', 'type', 'date', 'size', 'pages'], notes);

const assignments = tableRows('assignments');
appendInsert(lines, 'assignments', ['id', 'title', 'course', 'due_date', 'status', 'grade', 'max_grade', 'weight'], assignments);

const quizzes = tableRows('quizzes');
appendInsert(lines, 'quizzes', ['id', 'title', 'course', 'difficulty', 'question_count', 'duration', 'best_score', 'ai_generated'], quizzes);

const quizQuestions = tableRows('quiz_questions');
appendInsert(lines, 'quiz_questions', ['id', 'quiz_id', 'question', 'options', 'correct', 'explanation', 'order_idx'], quizQuestions);

const flashcards = tableRows('flashcards');
appendInsert(lines, 'flashcards', ['id', 'deck', 'front', 'back', 'ai_generated'], flashcards);

const videos = tableRows('videos');
appendInsert(lines, 'videos', ['id', 'title', 'channel', 'thumbnail', 'duration', 'views', 'relevance', 'course', 'uploaded_ago'], videos);

const studyPlan = tableRows('study_plan');
appendInsert(lines, 'study_plan', ['id', 'user_id', 'title', 'course', 'due_date', 'time', 'duration', 'type', 'completed'], studyPlan);

const forumThreads = tableRows('forum_threads');
appendInsert(lines, 'forum_threads', ['id', 'title', 'course', 'author', 'author_role', 'views', 'tags', 'solved', 'last_activity', 'content'], forumThreads);

const forumReplies = tableRows('forum_replies');
appendInsert(lines, 'forum_replies', ['id', 'thread_id', 'author', 'author_role', 'content', 'timestamp'], forumReplies, {
  timestamp: () => "NOW()",
});

const analyticsSnapshots = tableRows('analytics_snapshots');
appendInsert(lines, 'analytics_snapshots', ['id', 'user_id', 'overall_grade', 'quiz_average', 'study_hours', 'assignments_done', 'assignments_total', 'day_streak', 'courses_active', 'weekly_progress', 'recent_quiz_scores', 'subject_strengths', 'radar_data'], analyticsSnapshots, {
  weekly_progress: (value) => `${sqlString(JSON.stringify(value))}::jsonb`,
  recent_quiz_scores: (value) => `${sqlString(JSON.stringify(value))}::jsonb`,
  subject_strengths: (value) => `${sqlString(JSON.stringify(value))}::jsonb`,
  radar_data: (value) => `${sqlString(JSON.stringify(value))}::jsonb`,
  updated_at: () => 'NOW()',
});

lines.push('');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`Rows prepared: users=${users.length} courses=${courses.length} notes=${notes.length} assignments=${assignments.length} quizzes=${quizzes.length} quiz_questions=${quizQuestions.length} flashcards=${flashcards.length} videos=${videos.length} study_plan=${studyPlan.length} forum_threads=${forumThreads.length} forum_replies=${forumReplies.length} analytics_snapshots=${analyticsSnapshots.length}`);

db.close();
