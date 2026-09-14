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
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
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
  process.env.DATABASE_PROVIDER = 'sqlite';
  tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-retrieval-api-'));
  process.env.DB_PATH = path.join(tempDir, 'studyhub-retrieval-api.db');
  vi.resetModules();
  await import('../db/migrate-and-seed.ts');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalDbPath === 'string') process.env.DB_PATH = originalDbPath;
  else delete process.env.DB_PATH;
  if (typeof originalProvider === 'string') process.env.DATABASE_PROVIDER = originalProvider;
  else delete process.env.DATABASE_PROVIDER;
});

describe('knowledge retrieval API', () => {
  it('requires auth and ignores browser-supplied identity fields', async () => {
    const { default: router } = await import('../api/studyhub-sqlite');
    const db = (await import('better-sqlite3')).default;
    const database = new db(process.env.DB_PATH!);
    database.exec(`
      INSERT INTO learning_resources (id, course_id, title, created_by, visibility, status, current_version_id, published_at)
      VALUES ('api-resource', 'cs301', 'API Binary Search', 'u2', 'course', 'published', 'api-version', datetime('now'));
      INSERT INTO content_versions (id, resource_id, version_number, extraction_status, created_by, published_at)
      VALUES ('api-version', 'api-resource', 1, 'completed', 'u2', datetime('now'));
      INSERT INTO content_processing_jobs (id, version_id, status, attempt_count) VALUES ('api-job', 'api-version', 'completed', 1);
      INSERT INTO content_chunks (id, version_id, ordinal, text, heading_path) VALUES ('api-chunk', 'api-version', 1, 'API binary search complexity', 'Search');
    `);
    database.close();

    const app = express();
    app.use(express.json());
    app.use('/api', router);

    await withServer(app, async (baseUrl) => {
      const unauthenticated = await requestJSON(baseUrl, '/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'binary search' }),
      });
      expect(unauthenticated.response.status).toBe(401);

      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'student@studyhub.ai', password: 'student123' }),
      });
      const cookie = extractSessionCookie(login.response);
      const response = await requestJSON(baseUrl, '/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'binary search', userId: 'u3', role: 'admin', maxResults: 1 }),
      }, cookie);

      expect(response.response.status).toBe(200);
      expect(response.body.results[0].chunkId).toBe('api-chunk');
      expect(response.body.results).toHaveLength(1);
    });
  });
});