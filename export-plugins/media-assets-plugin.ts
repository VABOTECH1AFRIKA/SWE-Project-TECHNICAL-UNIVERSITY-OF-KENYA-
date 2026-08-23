import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import type { Plugin } from 'vite';

export const MANIFEST_FILENAME = 'airo-media.json';
const IMAGE_PREFIX = '/airo-assets/images/';
const VIDEO_PREFIX = '/airo-assets/videos/';
const UPLOAD_PREFIX = '/airo-assets/uploads/';

export interface MediaSlot {
  currentUrl?: string;
  lightSurfaceUrl?: string;
  darkSurfaceUrl?: string;
  alternatives?: string[];
}

export type MediaManifest = Record<string, MediaSlot>;

// Keep this list in sync with allowedImageRedirectHosts in
// dev-supervisor/internal/proxy/http/image_slots.go — both act as open-redirect
// guards and must agree on which CDN hosts are trusted.
const ALLOWED_IMAGE_HOSTS = new Set([
  'media.gettyimages.com',
  'media.istockphoto.com',
  'oaidalleapiprodscus.blob.core.windows.net',
  'blobby.wsimg.com',
  'blobby.test-wsimg.com',
  'blobby.dev-wsimg.com',
  'img1.wsimg.com',
  'isteam.wsimg.com',
  'isteam.test-wsimg.com',
  'isteam.dev-wsimg.com',
  'img.youtube.com',
  'i.ytimg.com',
]);

const ALLOWED_VIDEO_HOSTS = new Set([
  ...ALLOWED_IMAGE_HOSTS,
  'cdn.videvo.net',
  'player.vimeo.com',
  'www.youtube.com',
  'storage.googleapis.com',
]);

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

interface ManifestCacheEntry {
  manifest: MediaManifest;
  mtime: number;
}

const manifestCacheByRoot = new Map<string, ManifestCacheEntry>();

export async function loadMediaManifest(root: string): Promise<MediaManifest> {
  const manifestPath = path.join(root, MANIFEST_FILENAME);
  try {
    const { mtimeMs } = await stat(manifestPath);
    const cached = manifestCacheByRoot.get(root);
    if (cached && cached.mtime === mtimeMs) return cached.manifest;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MediaManifest;
    manifestCacheByRoot.set(root, { manifest, mtime: mtimeMs });
    return manifest;
  } catch {
    return {};
  }
}

export function buildUploadSearchPaths(root: string): string[] {
  const publicAssets = path.join(root, 'public', 'assets');
  return [
    publicAssets,
    path.join(publicAssets, 'media'),
    path.join(publicAssets, 'images'),
    path.join(publicAssets, 'uploads'),
    path.join(root, 'public', 'media'),
    path.join(root, 'public', 'images'),
  ];
}

export function findUploadFile(searchPaths: string[], filename: string): string | null {
  if (!filename || filename.includes('..') || filename.startsWith('/') || filename.includes('\0')) {
    return null;
  }

  for (const dir of searchPaths) {
    const candidate = path.resolve(dir, filename);
    const base = path.resolve(dir);
    if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) continue;
    if (!existsSync(candidate)) continue;
    if (!statSync(candidate).isFile()) continue;
    return candidate;
  }

  return null;
}

export function isAllowedRedirectUrl(targetUrl: string, allowedHosts: ReadonlySet<string>): boolean {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function parseSlotPath(pathname: string, prefix: string): {
  slotPath: string;
  surfaceVariant: 'light' | 'dark' | null;
} | null {
  if (!pathname.startsWith(prefix)) return null;
  const slotPath = pathname.slice(prefix.length);
  if (!slotPath) return null;

  if (slotPath.endsWith('/light')) {
    return { slotPath: slotPath.slice(0, -'/light'.length), surfaceVariant: 'light' };
  }
  if (slotPath.endsWith('/dark')) {
    return { slotPath: slotPath.slice(0, -'/dark'.length), surfaceVariant: 'dark' };
  }

  return { slotPath, surfaceVariant: null };
}

export function resolveSlotTargetUrl(
  slot: MediaSlot,
  surfaceVariant: 'light' | 'dark' | null,
  srcParam: string | null,
): string {
  let targetUrl = slot.currentUrl ?? '';
  if (surfaceVariant === 'light' && slot.lightSurfaceUrl) {
    targetUrl = slot.lightSurfaceUrl;
  } else if (surfaceVariant === 'dark' && slot.darkSurfaceUrl) {
    targetUrl = slot.darkSurfaceUrl;
  }

  if (
    srcParam &&
    (slot.currentUrl === srcParam || (slot.alternatives ?? []).includes(srcParam))
  ) {
    targetUrl = srcParam;
  }

  return targetUrl;
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function sendJson(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}

function serveLocalFile(res: ServerResponse, filePath: string): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypeFor(filePath));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  createReadStream(filePath).pipe(res);
}

function serveDataUri(res: ServerResponse, dataUri: string): void {
  const match = dataUri.match(/^data:([^;,]+)?(?:;base64)?,(.+)$/);
  if (!match) {
    sendJson(res, 400, JSON.stringify({ error: 'invalid data URI' }));
    return;
  }
  const isBase64 = dataUri.includes(';base64,');
  const contentType = match[1] || 'application/octet-stream';
  const payload = match[2] ?? '';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.end(isBase64 ? Buffer.from(payload, 'base64') : decodeURIComponent(payload));
}

function redirectTo(res: ServerResponse, targetUrl: string): void {
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Location', targetUrl);
  res.end();
}

function serveUpload(
  res: ServerResponse,
  root: string,
  uploadUrl: string,
): boolean {
  if (!uploadUrl.startsWith(UPLOAD_PREFIX)) return false;
  const filename = uploadUrl.slice(UPLOAD_PREFIX.length);
  const filePath = findUploadFile(buildUploadSearchPaths(root), filename);
  if (!filePath) {
    sendJson(res, 404, JSON.stringify({ error: 'file not found' }));
    return true;
  }
  serveLocalFile(res, filePath);
  return true;
}

function serveManifest(res: ServerResponse, root: string): void {
  const manifestPath = path.join(root, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    sendJson(res, 200, '{}');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  createReadStream(manifestPath).pipe(res);
}

function serveMediaSlot(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  manifest: MediaManifest,
  prefix: string,
  allowedHosts: ReadonlySet<string>,
): boolean {
  const pathname = (req.url ?? '').split('?')[0] ?? '';
  const parsed = parseSlotPath(pathname, prefix);
  if (!parsed) return false;

  const slot = manifest[parsed.slotPath];
  if (!slot) {
    sendJson(res, 404, JSON.stringify({ error: 'slot not found' }));
    return true;
  }

  const srcParam = new URL(req.url ?? '/', 'http://localhost').searchParams.get('src');
  const targetUrl = resolveSlotTargetUrl(slot, parsed.surfaceVariant, srcParam);
  if (!targetUrl) {
    sendJson(res, 404, JSON.stringify({ error: 'slot has no media URL' }));
    return true;
  }

  if (targetUrl.startsWith(UPLOAD_PREFIX)) {
    serveUpload(res, root, targetUrl);
    return true;
  }

  if (targetUrl.startsWith('data:')) {
    serveDataUri(res, targetUrl);
    return true;
  }

  if (isAllowedRedirectUrl(targetUrl, allowedHosts)) {
    redirectTo(res, targetUrl);
    return true;
  }

  sendJson(res, 500, JSON.stringify({ error: 'invalid media URL' }));
  return true;
}

export function createMediaAssetsMiddleware(getRoot: () => string): (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: Error) => void,
) => void {
  return function mediaAssetsMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const root = getRoot();
    const pathname = (req.url ?? '').split('?')[0] ?? '';

    if (pathname === `/${MANIFEST_FILENAME}`) {
      serveManifest(res, root);
      return;
    }

    if (pathname.startsWith(UPLOAD_PREFIX)) {
      const filename = pathname.slice(UPLOAD_PREFIX.length);
      const filePath = findUploadFile(buildUploadSearchPaths(root), filename);
      if (!filePath) {
        sendJson(res, 404, JSON.stringify({ error: 'file not found' }));
        return;
      }
      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeFor(filePath));
        res.end();
        return;
      }
      serveLocalFile(res, filePath);
      return;
    }

    loadMediaManifest(root).then(function resolveMedia(manifest) {
      if (serveMediaSlot(req, res, root, manifest, IMAGE_PREFIX, ALLOWED_IMAGE_HOSTS)) return;
      if (serveMediaSlot(req, res, root, manifest, VIDEO_PREFIX, ALLOWED_VIDEO_HOSTS)) return;
      next();
    }).catch(function onManifestError(err: Error) {
      next(err);
    });
  };
}

/** Standalone dev/preview middleware for exported AAB media slot URLs. */
export function mediaAssetsPlugin(): Plugin {
  let root = process.cwd();

  return {
    name: 'export-media-assets',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(createMediaAssetsMiddleware(() => root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMediaAssetsMiddleware(() => root));
    },
  };
}
