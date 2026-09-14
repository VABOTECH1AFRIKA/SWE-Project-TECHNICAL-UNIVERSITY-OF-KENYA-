import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import studyhubSqlite from './src/server/api/studyhub-sqlite.ts';

const tempDir = mkdtempSync(path.join(tmpdir(), 'studyhub-debug-'));
process.env.DB_PATH = path.join(tempDir, 'studyhub-debug.db');
await import('./src/server/db/migrate-and-seed.ts');

const app = express();
app.use(express.json());
app.use('/api', studyhubSqlite);

const server = app.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@studyhub.ai', password: 'student123' }),
    });
    console.log('status', res.status);
    console.log('body', await res.text());
  } catch (err) {
    console.error('caught', err);
  } finally {
    server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
