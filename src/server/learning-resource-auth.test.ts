import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function loadStudyhubSqlite() {
  vi.resetModules();
  const module = await import('./api/studyhub-sqlite');
  return module.default;
}

let tempDir = '';
const originalDbPath = process.env.DB_PATH;
const originalStorageRoot = process.env.CONTENT_STORAGE_ROOT;

async function withServer<T>(app: express.Express, run: (baseUrl: string) => Promise<T>): Promise<T> {
  let server: Server | null = null;
  try {
    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP listener');
    }
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    const activeServer = server;
    if (activeServer !== null) {
      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => (error ? reject(error) : resolve()));
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

async function requestMultipart(baseUrl: string, pathName: string, filename: string, mimeType: string, content: string, cookie: string) {
  const boundary = 'studyhub-test-boundary';
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--\r\n`, 'utf8');
  const response = await fetch(`${baseUrl}${pathName}`, { method: 'POST', body, headers: { Cookie: cookie, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(body.byteLength) } });
  return { response, body: await response.json() };
}

function extractSessionCookie(response: Response): string {
  const cookie = response.headers.get('set-cookie');
  if (!cookie) return '';
  return cookie.split(';')[0];
}

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-resource-'));
  process.env.DB_PATH = path.join(tempDir, 'studyhub-resource.db');
  process.env.CONTENT_STORAGE_ROOT = path.join(tempDir, 'storage');
  vi.resetModules();
  await import('./db/migrate-and-seed.ts');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalDbPath === 'string') {
    process.env.DB_PATH = originalDbPath;
  } else {
    delete process.env.DB_PATH;
  }
  if (typeof originalStorageRoot === 'string') {
    process.env.CONTENT_STORAGE_ROOT = originalStorageRoot;
  } else {
    delete process.env.CONTENT_STORAGE_ROOT;
  }
});

describe('learning resource authorization and visibility', () => {
  it('allows a lecturer to manage authorized courses only', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });

      expect(login.response.status).toBe(200);
      const cookie = extractSessionCookie(login.response);

      const allowed = await requestJSON(baseUrl, '/api/learning-resources', {}, cookie);
      expect(allowed.response.status).toBe(200);
      expect(Array.isArray(allowed.body)).toBe(true);

      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs301', title: 'Authorized lecture note', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      expect(create.response.status).toBe(201);
      expect(create.body.title).toBe('Authorized lecture note');
    });
  });

  it('rejects unauthorized course management for a lecturer', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });
      expect(login.response.status).toBe(200);
      const cookie = extractSessionCookie(login.response);

      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs304', title: 'Unauthorized course note', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      expect(create.response.status).toBe(403);
      expect(create.body.error).toBe('Forbidden');
    });
  });

  it('ignores browser-supplied user IDs and roles for the authenticated user', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
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

      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({
          courseId: 'cs301',
          title: 'Student upload attempt',
          resourceType: 'document',
          ownerUserId: 'u999',
          visibility: 'course',
          status: 'draft',
        }),
      }, cookie);

      expect(create.response.status).toBe(403);
      expect(create.body.error).toBe('Forbidden');

      const ingest = await requestJSON(baseUrl, '/api/learning-resources/does-not-matter/ingest', {
        method: 'POST',
        body: JSON.stringify({ userId: 'u999', role: 'admin', content: 'student must not upload' }),
      }, cookie);
      expect(ingest.response.status).toBe(403);
      expect(ingest.body.error).toBe('Forbidden');
    });
  });

  it('keeps students out of drafts, archived resources, and unauthorized courses', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
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

      const list = await requestJSON(baseUrl, '/api/learning-resources', {}, cookie);
      expect(list.response.status).toBe(200);
      expect(Array.isArray(list.body)).toBe(true);
      for (const item of list.body) {
        expect(item.status).toBe('published');
      }

      const unauthorized = await requestJSON(baseUrl, '/api/learning-resources?course=cs304', {}, cookie);
      expect(unauthorized.response.status).toBe(200);
      expect(unauthorized.body).toEqual([]);
    });
  });

  it('creates a processed content version and chunk records for staff-uploaded text', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });
      expect(login.response.status).toBe(200);
      const cookie = extractSessionCookie(login.response);

      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs301', title: 'Algorithms notes', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      expect(create.response.status).toBe(201);
      const resourceId = create.body.id;

      const upload = await requestJSON(baseUrl, `/api/learning-resources/${resourceId}/ingest`, {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'text/markdown',
          content: '# Binary Search\n\nBinary search halves the search space.\n\n## Complexity\n\nIt runs in O(log n) time and uses O(1) extra space.',
        }),
      }, cookie);

      expect(upload.response.status).toBe(201);
      expect(upload.body.version.resourceId).toBe(resourceId);
      expect(upload.body.version.extractionStatus).toBe('completed');
      expect(upload.body.processingJob.status).toBe('completed');
      expect(Array.isArray(upload.body.chunks)).toBe(true);
      expect(upload.body.chunks.length).toBeGreaterThan(0);
      expect(upload.body.chunks[0].text).toContain('Binary search');

      const repeatUpload = await requestJSON(baseUrl, `/api/learning-resources/${resourceId}/ingest`, {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'text/markdown',
          content: '# Binary Search\n\nBinary search halves the search space.\n\n## Complexity\n\nIt runs in O(log n) time and uses O(1) extra space.',
        }),
      }, cookie);
      expect(repeatUpload.response.status).toBe(201);
      const projectChunks = (chunks: Array<{ ordinal: number; text: string; tokenCount: number; charStart: number; charEnd: number }>) => chunks.map((chunk) => ({
        ordinal: chunk.ordinal,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
      }));
      expect(projectChunks(repeatUpload.body.chunks)).toEqual(projectChunks(upload.body.chunks));

      const later = await requestJSON(baseUrl, `/api/learning-resources/${resourceId}/versions`, {}, cookie);
      expect(later.response.status).toBe(200);
      expect(Array.isArray(later.body)).toBe(true);
      expect(later.body.length).toBeGreaterThan(0);
    });
  });

  it('rejects unsupported ingestion formats and unsafe filenames', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });
      const cookie = extractSessionCookie(login.response);
      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs301', title: 'Validation notes', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      const unsupported = await requestJSON(baseUrl, `/api/learning-resources/${create.body.id}/ingest`, {
        method: 'POST',
        body: JSON.stringify({ mimeType: 'application/pdf', filename: 'notes.pdf', content: 'not a PDF' }),
      }, cookie);
      expect(unsupported.response.status).toBe(415);

      const unsafeFilename = await requestJSON(baseUrl, `/api/learning-resources/${create.body.id}/ingest`, {
        method: 'POST',
        body: JSON.stringify({ mimeType: 'text/markdown', filename: '../notes.md', content: '# Notes' }),
      }, cookie);
      expect(unsafeFilename.response.status).toBe(400);
    });
  });

  it('accepts a multipart text upload and exposes processing status', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });
      const cookie = extractSessionCookie(login.response);
      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs301', title: 'Multipart notes', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      const upload = await requestMultipart(baseUrl, `/api/learning-resources/${create.body.id}/ingest`, 'notes.txt', 'text/plain', 'Binary search is logarithmic.', cookie);
      expect(upload.response.status).toBe(201);
      expect(upload.body.version.extractionStatus).toBe('completed');
      expect(upload.body.processingJob.status).toBe('completed');
      expect(upload.body.version.storageReference).toContain('content/');

      const status = await requestJSON(baseUrl, `/api/learning-resources/${create.body.id}/processing`, {}, cookie);
      expect(status.response.status).toBe(200);
      expect(status.body.processingJob.status).toBe('completed');

      const duplicateRetry = await requestJSON(baseUrl, `/api/learning-resources/${create.body.id}/retry-processing`, { method: 'POST', body: JSON.stringify({}) }, cookie);
      expect(duplicateRetry.response.status).toBe(409);
    });
  });

  it('persists failed processing and increments retry attempts for malformed files', async () => {
    const studyhubSqlite = await loadStudyhubSqlite();
    const app = express();
    app.use(express.json());
    app.use('/api', studyhubSqlite);

    await withServer(app, async (baseUrl) => {
      const login = await requestJSON(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'lecturer@studyhub.ai', password: 'lecturer123' }),
      });
      const cookie = extractSessionCookie(login.response);
      const create = await requestJSON(baseUrl, '/api/learning-resources', {
        method: 'POST',
        body: JSON.stringify({ courseId: 'cs301', title: 'Malformed PDF', resourceType: 'document', visibility: 'course', status: 'draft' }),
      }, cookie);

      const upload = await requestMultipart(baseUrl, `/api/learning-resources/${create.body.id}/ingest`, 'broken.pdf', 'application/pdf', 'not a PDF', cookie);
      expect(upload.response.status).toBe(422);
      expect(upload.body.processing.processingJob.status).toBe('failed');
      expect(upload.body.processing.version.extractionStatus).toBe('failed');
      expect(upload.body.processing.processingJob.attemptCount).toBe(1);

      const retry = await requestJSON(baseUrl, `/api/learning-resources/${create.body.id}/retry-processing`, { method: 'POST', body: JSON.stringify({}) }, cookie);
      expect(retry.response.status).toBe(422);
      expect(retry.body.processing.processingJob.status).toBe('failed');
      expect(retry.body.processing.processingJob.attemptCount).toBe(2);
    });
  });
});
