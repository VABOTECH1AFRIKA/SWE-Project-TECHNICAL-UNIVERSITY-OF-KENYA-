import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const root = process.cwd();
const dbPath = process.env.DB_PATH || path.join(root, 'studyhub.db');
const outputPath = path.join(root, 'supabase', 'migrations', '002_seed_sqlite_data.sql');

const db = new Database(dbPath, { readonly: true });
const jsonColumns = new Set(['options', 'tags', 'weekly_progress', 'recent_quiz_scores', 'subject_strengths', 'radar_data']);
const booleanColumns = new Set(['ai_generated', 'completed', 'solved']);

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function postgresLiteral(column, value) {
  if (value === null || value === undefined) return 'NULL';

  if (booleanColumns.has(column) && typeof value === 'number') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (jsonColumns.has(column)) {
    const jsonText = typeof value === 'string' ? value : JSON.stringify(value);
    return `CAST('${escapeSqlString(jsonText)}' AS jsonb)`;
  }

  const text = String(value);
  return `'${escapeSqlString(text)}'`;
}

const tableOrder = ['users', 'courses', 'notes', 'assignments', 'quizzes', 'quiz_questions', 'flashcards', 'videos', 'study_plan', 'forum_threads', 'forum_replies', 'analytics_snapshots'];

function rowsFor(table, orderBy='id') {
  return db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
}

const lines = [];
lines.push('-- Generated from SQLite source database: ' + dbPath);
lines.push('-- This file contains controlled data migration statements for the verified Supabase schema.');
lines.push('');

const counts = {};

for (const table of tableOrder) {
  const rows = rowsFor(table);
  counts[table] = rows.length;

  if (rows.length === 0) {
    continue;
  }

  const columns = Object.keys(rows[0]);

  for (const row of rows) {
    const values = columns.map((column) => postgresLiteral(column, row[column]));
    lines.push(`INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`);
  }

  lines.push('');
}

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${outputPath}`);
console.log(JSON.stringify(counts, null, 2));

db.close();
