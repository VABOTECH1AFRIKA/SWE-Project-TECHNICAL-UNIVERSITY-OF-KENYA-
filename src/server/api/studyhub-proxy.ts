/**
 * StudyHub AI — Express proxy to Python FastAPI backend
 *
 * In development the Python API runs on port 8000.
 * In production set PYTHON_API_URL env var to the deployed FastAPI URL.
 *
 * If the Python API is unreachable, the proxy falls back to the built-in
 * TypeScript data layer so the app keeps working without the Python server.
 */
import type { Request, Response, NextFunction } from 'express';

const PYTHON_API_URL =
  process.env.PYTHON_API_URL || 'http://localhost:8000';

async function proxyRequest(req: Request, res: Response): Promise<void> {
  const targetUrl = `${PYTHON_API_URL}${req.originalUrl}`;

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    init.body = JSON.stringify(req.body);
  }

  const upstream = await fetch(targetUrl, init);
  const data = await upstream.json();
  res.status(upstream.status).json(data);
}

export default async function studyhubProxy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Only proxy StudyHub-specific routes; let other /api/* routes fall through
  const studyhubPaths = [
    '/courses', '/notes', '/assignments', '/quizzes', '/flashcards',
    '/videos', '/study-plan', '/analytics', '/forum', '/notifications',
    '/admin', '/auth',
  ];

  const matches = studyhubPaths.some((p) => req.path.startsWith(p));
  if (!matches) {
    next();
    return;
  }

  try {
    await proxyRequest(req, res);
  } catch {
    // Python API unreachable — fall through to built-in fallback data
    next();
  }
}
