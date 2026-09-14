import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let tempDir = '';
const originalDbPath = process.env.DB_PATH;
const originalProvider = process.env.DATABASE_PROVIDER;

async function withServer<T>(app: express.Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  let server: Server | null = null;
  try {
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  }
}

async function requestJSON(baseUrl: string, pathName: string, options: RequestInit = {}, cookie?: string) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(`${baseUrl}${pathName}`, { ...options, headers, credentials: 'same-origin' });
  return { response, body: await response.json() };
}

function extractSessionCookie(response: Response): string {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

beforeEach(async () => {
  vi.resetModules();
  process.env.DATABASE_PROVIDER = 'sqlite';
  tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-tutor-'));
  process.env.DB_PATH = path.join(tempDir, 'studyhub-tutor.db');
  await import('./db/migrate-and-seed.ts');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalDbPath === 'string') process.env.DB_PATH = originalDbPath;
  else delete process.env.DB_PATH;
  if (typeof originalProvider === 'string') process.env.DATABASE_PROVIDER = originalProvider;
  else delete process.env.DATABASE_PROVIDER;
});

describe('Tutor API contract', () => {
  it('requires authentication and validates bounded messages', async () => {
    const { default: studyhubSqlite } = await import('./api/studyhub-sqlite');
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const unauthenticated = await requestJSON(baseUrl, '/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello' }),
      });
      expect(unauthenticated.response.status).toBe(401);
      expect(unauthenticated.body.error).toBe('Authentication required');
    });
  });

  it('uses the authenticated user and returns the deterministic contract', async () => {
    const { default: studyhubSqlite } = await import('./api/studyhub-sqlite');
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'student@studyhub.ai', password: 'student123' }),
      });
      expect(login.response.status).toBe(200);
      const cookie = extractSessionCookie(login.response);

      const malformed = await requestJSON(baseUrl, '/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message: '' }),
      }, cookie);
      expect(malformed.response.status).toBe(400);
      expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

      const response = await requestJSON(baseUrl, '/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message: 'Explain trees.', userId: 'u3', role: 'admin', mode: 'explain' }),
      }, cookie);

      expect(response.response.status).toBe(200);
      expect(response.body).toEqual({
        answer: 'StudyHub Tutor backend contract is active. Mode: explain. Model integration is not enabled yet.',
        status: 'ok',
        mode: 'explain',
        groundingStatus: 'not_grounded',
        citations: [],
        conversationId: expect.any(String),
      });
      expect(response.body.userId).toBeUndefined();
      expect(response.body.password_hash).toBeUndefined();
    });
  });

  it('rejects an oversized message after authentication', async () => {
    const { default: studyhubSqlite } = await import('./api/studyhub-sqlite');
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'student@studyhub.ai', password: 'student123' }),
      });
      const cookie = extractSessionCookie(login.response);
      const response = await requestJSON(baseUrl, '/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message: 'x'.repeat(4001) }),
      }, cookie);

      expect(response.response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('sanitizes orchestration failures at the HTTP boundary', async () => {
    const { default: studyhubSqlite } = await import('./api/studyhub-sqlite');
    const { tutorOrchestrator } = await import('./ai/tutor-orchestrator');
    const failure = vi.spyOn(tutorOrchestrator, 'respond').mockRejectedValue(new Error('private provider detail'));
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    try {
      await withServer(app, async (baseUrl) => {
        const login = await requestJSON(baseUrl, '/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'student@studyhub.ai', password: 'student123' }),
        });
        const cookie = extractSessionCookie(login.response);
        const response = await requestJSON(baseUrl, '/api/ai/tutor', {
          method: 'POST',
          body: JSON.stringify({ message: 'Question' }),
        }, cookie);

        expect(response.response.status).toBe(500);
        expect(response.body).toEqual({ error: { code: 'TUTOR_ERROR', message: 'Tutor service is unavailable.' } });
        expect(JSON.stringify(response.body)).not.toContain('private provider detail');
      });
    } finally {
      failure.mockRestore();
    }
  });
});
