import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let tempDir = '';
const originalDbPath = process.env.DB_PATH;
const originalProvider = process.env.DATABASE_PROVIDER;

async function loadRetrieval() {
  vi.resetModules();
  const { searchKnowledge } = await import('./retrieval');
  return searchKnowledge;
}

function insertFixtureData(): void {
  const db = new Database(process.env.DB_PATH!);
  try {
    db.exec(`
      INSERT INTO learning_resources (id, course_id, title, resource_type, created_by, visibility, status, current_version_id, published_at) VALUES
        ('resource-binary', 'cs301', 'Binary Search', 'document', 'u2', 'course', 'published', 'version-binary', '2026-09-01T00:00:00.000Z'),
        ('resource-hash', 'cs302', 'Hash Tables', 'document', 'u2', 'course', 'published', 'version-hash', '2026-09-01T00:00:00.000Z'),
        ('resource-draft', 'cs301', 'Draft Binary Notes', 'document', 'u2', 'course', 'draft', 'version-draft', NULL),
        ('resource-archived', 'cs301', 'Archived Binary Notes', 'document', 'u2', 'course', 'archived', 'version-archived', NULL),
        ('resource-failed', 'cs301', 'Failed Binary Notes', 'document', 'u2', 'course', 'published', 'version-failed', '2026-09-01T00:00:00.000Z'),
        ('resource-superseded', 'cs301', 'Versioned Binary Notes', 'document', 'u2', 'course', 'published', 'version-current', '2026-09-01T00:00:00.000Z');

      INSERT INTO content_versions (id, resource_id, version_number, extraction_status, created_by, superseded_at, published_at) VALUES
        ('version-binary', 'resource-binary', 1, 'completed', 'u2', NULL, '2026-09-01T00:00:00.000Z'),
        ('version-hash', 'resource-hash', 1, 'completed', 'u2', NULL, '2026-09-01T00:00:00.000Z'),
        ('version-draft', 'resource-draft', 1, 'completed', 'u2', NULL, NULL),
        ('version-archived', 'resource-archived', 1, 'completed', 'u2', NULL, NULL),
        ('version-failed', 'resource-failed', 1, 'failed', 'u2', NULL, NULL),
        ('version-old', 'resource-superseded', 1, 'completed', 'u2', '2026-09-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
        ('version-current', 'resource-superseded', 2, 'completed', 'u2', NULL, '2026-09-01T00:00:00.000Z');

      INSERT INTO content_processing_jobs (id, version_id, status, attempt_count) VALUES
        ('job-binary', 'version-binary', 'completed', 1),
        ('job-hash', 'version-hash', 'completed', 1),
        ('job-draft', 'version-draft', 'completed', 1),
        ('job-archived', 'version-archived', 'completed', 1),
        ('job-failed', 'version-failed', 'failed', 1),
        ('job-old', 'version-old', 'completed', 1),
        ('job-current', 'version-current', 'completed', 1);

      INSERT INTO content_chunks (id, version_id, ordinal, text, page_number, heading_path, metadata) VALUES
        ('chunk-binary', 'version-binary', 1, 'Binary search runs in logarithmic time on sorted data.', 3, 'Binary Search Complexity', '{}'),
        ('chunk-hash', 'version-hash', 1, 'Hash tables resolve a hash collision with chaining.', 4, 'Hash Collisions', '{}'),
        ('chunk-draft', 'version-draft', 1, 'Binary search draft content.', 1, 'Draft', '{}'),
        ('chunk-archived', 'version-archived', 1, 'Binary search archived content.', 1, 'Archived', '{}'),
        ('chunk-failed', 'version-failed', 1, 'Binary search failed content.', 1, 'Failed', '{}'),
        ('chunk-old', 'version-old', 1, 'Binary search old content.', 1, 'Old Version', '{}'),
        ('chunk-current', 'version-current', 1, 'Current binary search content.', 2, 'Current Version', '{}');
    `);
  } finally {
    db.close();
  }
}

beforeEach(async () => {
  process.env.DATABASE_PROVIDER = 'sqlite';
  tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-retrieval-'));
  process.env.DB_PATH = path.join(tempDir, 'studyhub-retrieval.db');
  vi.resetModules();
  await import('../db/migrate-and-seed.ts');
  insertFixtureData();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (typeof originalDbPath === 'string') process.env.DB_PATH = originalDbPath;
  else delete process.env.DB_PATH;
  if (typeof originalProvider === 'string') process.env.DATABASE_PROVIDER = originalProvider;
  else delete process.env.DATABASE_PROVIDER;
});

describe('knowledge retrieval', () => {
  it('returns authorized published content with provenance and deterministic relevance', async () => {
    const searchKnowledge = await loadRetrieval();
    const result = await searchKnowledge({ userId: 'u1', role: 'student', query: 'binary search complexity' });

    expect(result.hasSufficientEvidence).toBe(true);
    expect(result.results[0]).toMatchObject({
      chunkId: 'chunk-binary',
      resourceId: 'resource-binary',
      versionId: 'version-binary',
      title: 'Binary Search',
      courseId: 'cs301',
      pageNumber: 3,
      headingPath: 'Binary Search Complexity',
    });
    expect(result.results[0].citation.chunkId).toBe('chunk-binary');
  });

  it('applies course authorization before searching and excludes unsafe states', async () => {
    const searchKnowledge = await loadRetrieval();

    await expect(searchKnowledge({ userId: 'u4', role: 'student', query: 'binary search' })).resolves.toMatchObject({ results: [] });
    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: 'draft binary' })).resolves.toMatchObject({ results: [] });
    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: 'archived binary' })).resolves.toMatchObject({ results: [] });
    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: 'failed binary' })).resolves.toMatchObject({ results: [] });
    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: 'old content' })).resolves.toMatchObject({ results: [] });
  });

  it('returns only the current version, honors limits, and normalizes whitespace', async () => {
    const searchKnowledge = await loadRetrieval();
    const result = await searchKnowledge({ userId: 'u1', role: 'student', query: '  binary   search  ', maxResults: 1 });

    expect(result.query).toBe('binary search');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].chunkId).not.toBe('chunk-old');
  });

  it('rejects empty and oversized queries', async () => {
    const searchKnowledge = await loadRetrieval();

    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: '   ' })).rejects.toThrow('required');
    await expect(searchKnowledge({ userId: 'u1', role: 'student', query: 'x'.repeat(501) })).rejects.toThrow('500');
  });

  it('supplies retrieved sources through the Tutor context boundary', async () => {
    const searchKnowledge = await loadRetrieval();
    const { RetrievalTutorContextProvider } = await import('../ai/tutor-context');
    const context = await new RetrievalTutorContextProvider().getContext({
      user: { id: 'u1', role: 'student' },
      request: { message: 'binary search complexity', mode: 'explain' },
    });

    expect(context.sources[0]).toMatchObject({ sourceId: 'chunk-binary', title: 'Binary Search' });
    expect(context.courseContext[0]).toContain('logarithmic');
    expect(searchKnowledge).toBeTypeOf('function');
  });
});