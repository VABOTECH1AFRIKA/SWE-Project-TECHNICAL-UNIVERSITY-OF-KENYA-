import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import studyhubSqlite from './api/studyhub-sqlite';

let tempDir = '';
const originalDbPath = process.env.DB_PATH;

async function withServer<T>(app: express.Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  let server: Server | null = null;
  try {
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP listener');
    }
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}

async function requestJSON(baseUrl: string, pathName: string, options: RequestInit = {}, cookie?: string) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  return {
    response,
    body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text(),
  };
}

function extractSessionCookie(response: Response): string {
  const cookie = response.headers.get('set-cookie');
  if (!cookie) return '';
  return cookie.split(';')[0];
}

beforeEach(async () => {
  vi.resetModules();
  tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-auth-'));
  process.env.DB_PATH = path.join(tempDir, 'studyhub-auth.db');
  await import('./db/migrate-and-seed.ts');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalDbPath === 'string') {
    process.env.DB_PATH = originalDbPath;
  } else {
    delete process.env.DB_PATH;
  }
});

describe('StudyHub auth hardening', () => {
  it('issues an authenticated session cookie on successful login', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Auth Tester',
          email: 'auth-tester@example.com',
          password: 'secret123',
          role: 'student',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'auth-tester@example.com',
          password: 'secret123',
        }),
      });

      expect(login.response.status).toBe(200);
      expect(extractSessionCookie(login.response)).toContain('studyhub_session=');
      expect(login.body.user.email).toBe('auth-tester@example.com');
    });
  });

  it('rejects invalid credentials', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bad Login',
          email: 'bad-login@example.com',
          password: 'secret123',
          role: 'student',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'bad-login@example.com',
          password: 'wrong-password',
        }),
      });

      expect(login.response.status).toBe(401);
      expect(login.body.error).toContain('Invalid');
    });
  });

  it('returns 401 when protected routes are requested without authentication', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const response = await requestJSON(baseUrl, '/api/study-plan');

      expect(response.response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  it('fails with 401 for invalid or tampered session cookies', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const profile = await requestJSON(baseUrl, '/api/user/me', {}, 'studyhub_session=bad-cookie');
      expect(profile.response.status).toBe(401);
      expect(profile.body.error).toBe('Authentication required');
    });
  });

  it('allows an authenticated student to access their own study plan and analytics', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Student User',
          email: 'student-one@example.com',
          password: 'secret123',
          role: 'student',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student-one@example.com',
          password: 'secret123',
        }),
      });
      expect(login.response.status).toBe(200);

      const cookie = extractSessionCookie(login.response);
      const studyPlan = await requestJSON(baseUrl, '/api/study-plan', {}, cookie);
      expect(studyPlan.response.status).toBe(200);
      expect(Array.isArray(studyPlan.body)).toBe(true);

      const analytics = await requestJSON(baseUrl, '/api/analytics', {}, cookie);
      expect(analytics.response.status).toBe(200);
      expect(analytics.body).toHaveProperty('overallGrade');
    });
  });

  it('rejects cross-role access to admin routes', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Student Admin Attempt',
          email: 'student-admin-attempt@example.com',
          password: 'secret123',
          role: 'student',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'student-admin-attempt@example.com',
          password: 'secret123',
        }),
      });
      expect(login.response.status).toBe(200);

      const cookie = extractSessionCookie(login.response);
      const response = await requestJSON(baseUrl, '/api/admin/users', {}, cookie);

      expect(response.response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  it('allows admin-only access to admin routes', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Admin User',
          email: 'admin-route@example.com',
          password: 'secret123',
          role: 'admin',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin-route@example.com',
          password: 'secret123',
        }),
      });
      expect(login.response.status).toBe(200);

      const cookie = extractSessionCookie(login.response);
      const response = await requestJSON(baseUrl, '/api/admin/users', {}, cookie);

      expect(response.response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  it('does not allow a request to impersonate another user via manually supplied identifiers', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const register = await requestJSON(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Impersonator',
          email: 'impersonator@example.com',
          password: 'secret123',
          role: 'student',
        }),
      });
      expect(register.response.status).toBe(201);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'impersonator@example.com',
          password: 'secret123',
        }),
      });
      expect(login.response.status).toBe(200);

      const cookie = extractSessionCookie(login.response);
      const response = await requestJSON(baseUrl, '/api/user/me', {}, cookie);

      expect(response.response.status).toBe(200);
      expect(response.body.email).toBe('impersonator@example.com');
      expect(response.body.id).not.toBe('u1');
    });
  });
});
