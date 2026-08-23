import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

const SIDECAR_DIRNAME = 'format-overrides';
export const FORMAT_OVERRIDES_MODULE_ID = 'virtual:format-overrides';
const RESOLVED_FORMAT_OVERRIDES_MODULE_ID = `\0${FORMAT_OVERRIDES_MODULE_ID}`;
const EMPTY_SIDECAR = { version: 1, overrides: {} };
const EMPTY_BUNDLE = { version: 1, scopes: {} };

function readSidecarFile(filePath: string): unknown {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.overrides ||
      typeof parsed.overrides !== 'object' ||
      Array.isArray(parsed.overrides)
    ) {
      return EMPTY_SIDECAR;
    }
    return parsed;
  } catch {
    return EMPTY_SIDECAR;
  }
}

function collectSidecarFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return collectSidecarFiles(fullPath);
    return entry.endsWith('.json') ? [fullPath] : [];
  });
}

function scopeFromFile(sidecarRoot: string, filePath: string): string {
  const relative = path.relative(sidecarRoot, filePath).replace(/\\/g, '/');
  return relative.replace(/\.json$/, '');
}

function readSidecarBundle(root: string): unknown {
  const sidecarRoot = path.join(root, SIDECAR_DIRNAME);
  if (!existsSync(sidecarRoot)) return EMPTY_BUNDLE;

  const scopes = Object.fromEntries(
    collectSidecarFiles(sidecarRoot)
      .sort()
      .map((filePath) => {
        const scope = scopeFromFile(sidecarRoot, filePath);
        return [scope, readSidecarFile(filePath)];
      }),
  );

  return { version: 1, scopes };
}

function buildModule(root: string): string {
  return `export default ${JSON.stringify(readSidecarBundle(root))};`;
}

/** Standalone build shim for exported projects (no AAB dev-server hooks). */
export function formatOverridesPlugin(root: string = process.cwd()): Plugin {
  return {
    name: 'format-overrides',
    resolveId(id) {
      return id === FORMAT_OVERRIDES_MODULE_ID ? RESOLVED_FORMAT_OVERRIDES_MODULE_ID : null;
    },
    load(id) {
      return id === RESOLVED_FORMAT_OVERRIDES_MODULE_ID ? buildModule(root) : null;
    },
  };
}
