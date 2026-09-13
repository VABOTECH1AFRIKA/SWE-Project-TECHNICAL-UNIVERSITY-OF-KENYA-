import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { dataAccess } from '../data';

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

export function parseSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie ?? '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!sessionCookie) return null;

  const rawValue = sessionCookie.slice(AUTH_COOKIE_NAME.length + 1);
  return rawValue ? decodeURIComponent(rawValue) : null;
}

export async function setAuthSession(res: Response, user: SessionUser): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await dataAccess.sessions.create(token, user);

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

export async function revokeSession(token: string): Promise<void> {
  await dataAccess.sessions.revoke(token);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = parseSessionCookie(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const session = await dataAccess.sessions.validate(token);
  const user = session ? await dataAccess.users.getById(session.user_id) : null;

  if (!user) {
    await revokeSession(token);
    clearAuthSession(res);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  (req as AuthenticatedRequest).user = combineUser(user);
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
