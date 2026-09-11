import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import Database from 'better-sqlite3';

export const AUTH_COOKIE_NAME = 'studyhub_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Role = 'student' | 'lecturer' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string;
  program?: string;
  year?: number;
  department?: string;
  streak?: number;
  status?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

function getDbPath(): string {
  return process.env.DB_PATH || path.join('/private', 'studyhub.db');
}

function getDb() {
  const db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function ensureSessionTable(): void {
  const db = getDb();
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
  db.close();
}

function combineUser(row: any): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    program: row.program ?? undefined,
    year: row.year ?? undefined,
    department: row.department ?? undefined,
    streak: row.streak ?? undefined,
    status: row.status ?? undefined,
  };
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie ?? '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!sessionCookie) return null;

  const rawValue = sessionCookie.slice(AUTH_COOKIE_NAME.length + 1);
  return rawValue ? decodeURIComponent(rawValue) : null;
}

function removeExpiredSessions(db: Database.Database): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

function getSessionUserFromToken(token: string): SessionUser | null {
  ensureSessionTable();
  const db = getDb();
  try {
    removeExpiredSessions(db);

    const row: any = db.prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.avatar,
        u.program,
        u.year,
        u.department,
        u.streak,
        u.status
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ?
      LIMIT 1
    `).get(hashSessionToken(token));

    if (!row) return null;

    return combineUser(row);
  } finally {
    db.close();
  }
}

export function setAuthSession(res: Response, user: SessionUser): void {
  ensureSessionTable();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const db = getDb();

  try {
    db.prepare(
      'INSERT INTO sessions (id, id_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(token, hashSessionToken(token), user.id, expiresAt, new Date().toISOString(), new Date().toISOString());
  } finally {
    db.close();
  }

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAuthSession(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function revokeSession(token: string): void {
  const db = getDb();
  try {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashSessionToken(token));
  } finally {
    db.close();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = parseSessionCookie(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = getSessionUserFromToken(token);

  if (!user) {
    revokeSession(token);
    clearAuthSession(res);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  (req as AuthenticatedRequest).user = user;
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
