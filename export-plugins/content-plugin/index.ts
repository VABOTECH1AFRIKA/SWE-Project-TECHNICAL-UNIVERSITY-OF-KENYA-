import type { Plugin } from 'vite';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { parseJson } from './parse.js';
import {
  CONTENT_SUBDIRS, canonicalKeyFor, classifyDirents,
  isCollectionItem, findFatalDuplicates,
  assertSafeContentName, exportableAliasNames, normalizeCollectionItem,
  type DirentLike, type KeyedEntry,
} from './keys.js';

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;
const AIRO_CONTENT_ID = '@airo/content';

function directImportError(rel: string): Error {
  return new Error(
    `[airo-content] Direct import of ${rel} is forbidden. ` +
    `Content files under src/content/ must be consumed through the ` +
    `virtual module:\n\n` +
    `  import { <key> } from 'virtual:content';\n\n` +
    `See src/content/virtual-content.d.ts for available keys.`,
  );
}

interface Options {
  contentDir?: string;
}

type DiscoveredEntry =
  | (KeyedEntry & { kind: 'file'; absPath: string })
  | (KeyedEntry & { kind: 'collection'; dirPath: string; itemPaths: string[] });

/**
 * Emits a virtual `virtual:content` module whose exports are the parsed content
 * of `src/content/**`, validated at module-eval time against schemas exported
 * from `src/content/schemas.ts`.
 *
 * Discovery rules:
 *   src/content/site.json           → `site`
 *   src/content/pages/<name>.json   → `pages.<name>` (+ a bare `<name>` alias if unique)
 *   src/content/data/<name>.json    → `data.<name>` (+ a bare `<name>` alias if unique)
 *   src/content/data/<name>/        → `data.<name>` as an array (+ alias if unique)
 */
export function contentPlugin(options: Options = {}): Plugin {
  const relContentDir = options.contentDir ?? 'src/content';
  let projectRoot: string;
  let contentDir: string;
  let schemasImportPath: string;

  return {
    name: 'airo-content',
    // `enforce: 'pre'` gives us resolveId priority over Vite's built-in JSON
    // plugin, so we can block direct .json imports under src/content/ before
    // Vite serves the file.
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root;
      contentDir = path.resolve(config.root, relContentDir);
      schemasImportPath = '/' + path.posix.join(relContentDir, 'schemas');
    },

    configureServer(s) {
      // Register the reload handlers UNCONDITIONALLY. Vite's dev-server watcher
      // already covers the project root, so a `src/content/` that appears AFTER
      // the server boots — an agent scaffolding the content layer mid-session,
      // or the first content edit — still hot-reloads. Returning early when the
      // dir was absent at boot (skipping these handlers) was a bug: late-created
      // content never invalidated the cached `virtual:content` module.
      //
      // On content file change: reload just the virtual:content module and
      // let Vite's HMR propagate through its importers (the React plugin
      // injects `import.meta.hot.accept` in component files, so React Fast
      // Refresh re-renders in place — no full page reload, no flash).
      const invalidate = (file: string, event: string) => {
        if (!file.startsWith(contentDir)) return;
        s.config.logger.info(`[airo-content] ${event}: ${path.relative(projectRoot, file)}`);
        const mod = s.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (!mod) {
          s.config.logger.info(`[airo-content] virtual:content not yet in module graph — skipping reload`);
          return;
        }
        void s.reloadModule(mod)
          .then(() => {
            s.config.logger.info(`[airo-content] reloaded virtual:content (HMR propagating)`);
          })
          .catch((err) => {
            s.config.logger.error(
              `[airo-content] HMR reload failed for virtual:content: ${String(err)}`,
              { error: err as Error },
            );
            try {
              s.ws.send({ type: 'full-reload', path: '*' });
            } catch {
              // dev server shutting down
            }
          });
      };
      s.watcher.on('change', (f) => invalidate(f, 'change'));
      s.watcher.on('add', (f) => invalidate(f, 'add'));
      s.watcher.on('unlink', (f) => invalidate(f, 'unlink'));

      if (!existsSync(contentDir)) {
        s.config.logger.info(`[airo-content] no ${relContentDir}/ yet — watcher armed, awaiting content`);
        return;
      }
      s.watcher.add(contentDir);

      // Eager schema validation: evaluate schemas.ts and validate every
      // discovered content file at dev-server start. Mismatches surface in
      // dev-server stderr rather than the browser's runtime console — which
      // is the channel agents read (`agents/dev.log`) for self-correction.
      void validateContentEager(s, contentDir, schemasImportPath).catch((err) => {
        s.config.logger.error(String(err), { error: err as Error });
      });
    },

    resolveId(source, importer) {
      if (source === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;

      if (source === AIRO_CONTENT_ID) {
        return path.resolve(projectRoot, 'content-lib/src/index.ts');
      }

      // The virtual module's own import of schemas.ts must pass through.
      if (importer === RESOLVED_VIRTUAL_ID) return undefined;

      // Block ALL direct imports that resolve under src/content/. The CMS
      // contract is that content is only consumed through `virtual:content`;
      // any direct import (JSON, barrel .ts re-exports, etc.) bypasses schema
      // validation and source-mapper attribution, silently breaking inline
      // editing. Rejecting loudly is the fix.
      const cleanSource = source.replace(/[?#].*$/, '');

      const resolved = resolveAbsolute(cleanSource, importer, projectRoot);
      if (!resolved) return undefined;

      if (
        (resolved === contentDir || resolved.startsWith(contentDir + path.sep)) &&
        !isContentMetaModule(resolved, contentDir)
      ) {
        throw directImportError(path.relative(path.dirname(contentDir), resolved));
      }

      return undefined;
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        const entries = await discover(contentDir);
        const schemasPath = path.join(contentDir, 'schemas.ts');
        return emitVirtualModule(entries, schemasImportPath, schemasPath);
      }

      // Guard against alias-resolved imports (e.g. @/content → src/content/index.ts).
      // resolveId can't catch bare specifiers; this load hook sees the resolved path.
      const cleanId = id.replace(/[?#].*$/, '');
      if (
        (cleanId === contentDir || cleanId.startsWith(contentDir + path.sep)) &&
        !isContentMetaModule(cleanId, contentDir)
      ) {
        throw directImportError(path.relative(path.dirname(contentDir), cleanId));
      }

      return undefined;
    },
  };
}

export default contentPlugin;

async function discover(contentDir: string): Promise<DiscoveredEntry[]> {
  const entries: DiscoveredEntry[] = [];

  // Enforce layout: the ONLY JSON allowed at the content-dir top level is
  // site.json. Page content belongs under pages/; data collections under
  // data/. Agents sometimes default to writing `src/content/<name>.json` —
  // failing loudly here points them at the right subdirectory.
  if (await exists(contentDir)) {
    for (const entry of await fs.readdir(contentDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      // Ignore dotfiles (e.g. `.user-edits.json`, the CMS user-edit provenance
      // record, and any future metadata dotfile) — they are sidecars, not
      // content, so they must not trip the layout validator.
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'site.json') continue;
      throw new Error(
        `[airo-content] Unexpected file src/content/${entry.name}.\n` +
        `Page content belongs at src/content/pages/${entry.name}.\n` +
        `Data collections belong at src/content/data/${entry.name}.\n` +
        `The only JSON allowed directly at src/content/ is site.json.`,
      );
    }
  }

  const siteAbsPath: string = path.join(contentDir, 'site.json');
  if (await exists(siteAbsPath)) {
    entries.push({
      canonicalKey: canonicalKeyFor(null, 'site'),
      bareName: 'site',
      subdir: null,
      kind: 'file',
      relPath: 'site.json',
      absPath: siteAbsPath,
    });
  }

  for (const subdir of CONTENT_SUBDIRS) {
    const dir: string = path.join(contentDir, subdir);
    if (!(await exists(dir))) continue;

    const dirents: DirentLike[] = (await fs.readdir(dir, { withFileTypes: true })).map(
      (d): DirentLike => ({ name: d.name, isDirectory: d.isDirectory() }),
    );

    for (const keyed of classifyDirents(subdir, dirents)) {
      assertSafeContentName(keyed.bareName, keyed.relPath);

      if (keyed.kind === 'file') {
        entries.push({ ...keyed, kind: 'file', absPath: path.join(contentDir, keyed.relPath) });
        continue;
      }

      const collectionDir: string = path.join(contentDir, keyed.relPath);
      const itemPaths: string[] = (await fs.readdir(collectionDir))
        .filter(isCollectionItem)
        .sort()
        .map((f: string): string => path.join(collectionDir, f));
      entries.push({ ...keyed, kind: 'collection', dirPath: collectionDir, itemPaths });
    }
  }

  const duplicates: Array<[KeyedEntry, KeyedEntry]> = findFatalDuplicates(entries);
  if (duplicates.length > 0) {
    const [first, second]: [KeyedEntry, KeyedEntry] = duplicates[0]!;
    throw duplicateKeyError(contentDir, first as DiscoveredEntry, second as DiscoveredEntry);
  }

  return entries;
}

/** `src/content/`-relative display path for an entry, for use in error messages. */
function displayPath(contentDir: string, entry: DiscoveredEntry): string {
  const abs: string = entry.kind === 'file' ? entry.absPath : entry.dirPath;
  const rel: string = path.relative(contentDir, abs).split(path.sep).join('/');
  return entry.kind === 'file' ? `src/content/${rel}` : `src/content/${rel}/ (collection)`;
}

// findFatalDuplicates only reports same-namespace collisions (D4) — a file and
// a directory both claiming data/blog. Cross-namespace pairs (pages/blog.json
// vs data/blog.json) already coexist as distinct namespace exports.
function duplicateKeyError(contentDir: string, first: DiscoveredEntry, second: DiscoveredEntry): Error {
  return new Error(
    `[airo-content] duplicate content key "${second.canonicalKey}" — both of these export "${second.canonicalKey}":\n` +
    `  ${displayPath(contentDir, first)}\n` +
    `  ${displayPath(contentDir, second)}\n` +
    `Delete or rename one of them so the keys differ.\n` +
    `Keys must be camelCase JS identifiers; hyphens are rejected.`,
  );
}

function normalizeItem(absPath: string, raw: string): unknown {
  return normalizeCollectionItem(path.basename(absPath), raw);
}

async function readEntryValue(entry: DiscoveredEntry): Promise<unknown> {
  if (entry.kind === 'file') {
    const raw: string = await fs.readFile(entry.absPath, 'utf8');
    return parseJson(raw);
  }
  return Promise.all(
    entry.itemPaths.map(async (p: string): Promise<unknown> => {
      const raw: string = await fs.readFile(p, 'utf8');
      return normalizeItem(p, raw);
    }),
  );
}

function entryLocation(entry: DiscoveredEntry): string {
  return entry.kind === 'file' ? entry.absPath : `collection ${entry.canonicalKey}`;
}

async function readLiteral(entry: DiscoveredEntry): Promise<string> {
  let value: unknown;
  try {
    value = await readEntryValue(entry);
  } catch (err) {
    const msg: string = err instanceof Error ? err.message : String(err);
    throw new Error(`[airo-content] failed to parse ${entryLocation(entry)}: ${msg}`);
  }
  return JSON.stringify(value, null, 2);
}

/** Bare names claimed by exactly one entry — the only names a flat schema can unambiguously describe. */
function uniqueBareNameSet(entries: readonly KeyedEntry[]): ReadonlySet<string> {
  const counts: Map<string, number> = new Map();
  for (const e of entries) counts.set(e.bareName, (counts.get(e.bareName) ?? 0) + 1);
  const out: Set<string> = new Set();
  for (const [name, n] of counts) if (n === 1) out.add(name);
  return out;
}

async function emitVirtualModule(
  entries: DiscoveredEntry[],
  schemasImportPath: string,
  schemasPath: string,
): Promise<string> {
  const hasSchemas: boolean = await exists(schemasPath);
  const lines: string[] = [];

  if (hasSchemas) {
    lines.push(`import { schemas } from '${schemasImportPath}';`);
    lines.push(`const identity = { parse: (v) => v };`);
  }
  lines.push('');

  const aliasable: ReadonlySet<string> = exportableAliasNames(entries);
  const uniqueBareNames: ReadonlySet<string> = uniqueBareNameSet(entries);
  const aliasLines: string[] = [];

  const siteEntry: DiscoveredEntry | undefined = entries.find(
    (e: DiscoveredEntry): boolean => e.subdir === null,
  );
  if (siteEntry) {
    const literal: string = await readLiteral(siteEntry);
    lines.push(
      hasSchemas
        ? `export const site = (schemas.site ?? identity).parse(${literal});`
        : `export const site = ${literal};`,
    );
  }

  for (const subdir of CONTENT_SUBDIRS) {
    const namespaceEntries: DiscoveredEntry[] = entries.filter(
      (e: DiscoveredEntry): boolean => e.subdir === subdir,
    );
    if (namespaceEntries.length === 0) continue;

    const props: string[] = [];
    for (const entry of namespaceEntries) {
      const literal: string = await readLiteral(entry);
      // The flat fallback is only consulted when exactly one entry claims the bare name. A
      // hand-written `schemas.blog` cannot say which of pages.blog / data.blog it describes, so
      // consulting it for both would parse one document against the other's schema — the same
      // flat-namespace collapse this module fixes for keys.
      const flatFallback: string = uniqueBareNames.has(entry.bareName)
        ? ` ?? schemas.${entry.bareName}`
        : '';
      const expr: string = hasSchemas
        ? `(schemas.${subdir}?.${entry.bareName}${flatFallback} ?? identity).parse(${literal})`
        : literal;
      props.push(`  ${JSON.stringify(entry.bareName)}: ${expr},`);

      // A name that is unambiguous but not a legal binding (a JS reserved word) stays reachable
      // through the namespace object without an alias.
      if (aliasable.has(entry.bareName)) {
        aliasLines.push(`export const ${entry.bareName} = ${subdir}.${entry.bareName};`);
      }
    }

    lines.push(`export const ${subdir} = {`, ...props, '};');
  }

  lines.push(...aliasLines);

  // Accept HMR updates to prevent Vite's full-reload fallback when the
  // module structure changes (new exports from content_scaffold). The accept
  // callback invalidates the module so Vite re-propagates to importers —
  // React components with Fast Refresh boundaries re-render with new data.
  // On the initial structural change (no importer in graph yet), invalidate
  // is a no-op but at least prevents the disruptive full-page reload; the
  // paired .tsx write triggers its own Fast Refresh.
  lines.push('');
  lines.push('if (import.meta.hot) {');
  lines.push('  import.meta.hot.accept(() => {');
  lines.push('    import.meta.hot.invalidate();');
  lines.push('  });');
  lines.push('}');

  return lines.join('\n') + '\n';
}

/**
 * Evaluate `schemas.ts` via the dev server's SSR module loader and validate
 * every discovered content file against its matching schema. Any Zod parse
 * error is rethrown with the file path prefixed so dev-server stderr shows
 * exactly which file is wrong.
 *
 * Exported for testability. Callers inject a loader that mimics Vite's
 * `server.ssrLoadModule` signature so tests don't need a live server.
 */
export async function validateContentEager(
  server: {
    ssrLoadModule: (url: string) => Promise<Record<string, unknown>>;
  },
  contentDir: string,
  schemasImportPath: string,
): Promise<void> {
  const schemasPath = path.join(contentDir, 'schemas.ts');
  if (!(await exists(schemasPath))) {
    // Schemas are optional — no file means no validation, matching the
    // pass-through behavior of the existing load() hook.
    return;
  }

  let mod: Record<string, unknown>;
  try {
    mod = await server.ssrLoadModule(schemasImportPath);
  } catch (err) {
    throw new Error(
      `[airo-content] failed to evaluate ${schemasPath}: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const schemas = mod.schemas as Record<string, { parse: (v: unknown) => unknown } | undefined> | undefined;
  if (!schemas || typeof schemas !== 'object') {
    // schemas.ts exists but doesn't export `schemas` — skip gracefully so
    // users can scaffold incrementally without blocking dev-server start.
    return;
  }

  const entries: DiscoveredEntry[] = await discover(contentDir);
  const uniqueBareNames: ReadonlySet<string> = uniqueBareNameSet(entries);
  for (const entry of entries) {
    const where: string = entryLocation(entry);
    let value: unknown;
    try {
      value = await readEntryValue(entry);
    } catch (err) {
      throw new Error(
        `[airo-content] failed to parse ${where}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // D8: a nested schema (schemas.pages.home) takes priority over a flat
    // one (schemas.home) sharing the bare name, so both shapes validate.
    type SchemaMap = Record<string, { parse: (v: unknown) => unknown } | undefined>;
    const namespaceSchemas: SchemaMap | undefined =
      entry.subdir ? (schemas[entry.subdir] as SchemaMap | undefined) : undefined;
    const schema: { parse: (v: unknown) => unknown } | undefined =
      namespaceSchemas?.[entry.bareName] ??
      (uniqueBareNames.has(entry.bareName) ? schemas[entry.bareName] : undefined);
    if (!schema) continue; // unregistered key — pass-through
    if (typeof schema.parse !== 'function') continue; // non-Zod export — skip silently

    try {
      schema.parse(value);
    } catch (err) {
      throw new Error(
        `[airo-content] content in ${where} does not match schemas.${entry.bareName}:\n` +
        (err instanceof Error ? err.message : String(err)),
      );
    }
  }
}

/**
 * Best-effort resolution of a Vite `resolveId` source string to an absolute
 * filesystem path. Handles absolute paths, relative paths from an importer,
 * and Vite's convention where a leading `/` means project-root-relative.
 *
 * Returns undefined for unresolvable sources (bare specifiers, node:*, etc.);
 * callers should treat undefined as "not our concern."
 */
function resolveAbsolute(
  source: string,
  importer: string | undefined,
  projectRoot: string,
): string | undefined {
  // Strip query/hash (Vite uses `?raw`, `?url`, etc. as suffixes)
  const clean = source.replace(/[?#].*$/, '');

  // On POSIX a leading `/` makes isAbsolute() true. Vite also treats
  // leading-`/` sources as project-root-relative inside some transform
  // contexts. Rather than guess which convention applies, try both and
  // return whichever lands inside the project tree first.
  if (clean.startsWith('/')) {
    const osAbs = clean; // treat as already-absolute
    const rootRel = path.resolve(projectRoot, clean.slice(1));
    // If the OS-absolute interpretation doesn't live under projectRoot,
    // prefer the project-root-relative interpretation — the only way a
    // leading-`/` import resolves under projectRoot is either via an OS
    // path that already happens to sit there (the alias-resolved case) or
    // via Vite's root-relative convention (the "/src/..." case).
    return osAbs.startsWith(projectRoot + path.sep) ? osAbs : rootRel;
  }

  if (clean.startsWith('./') || clean.startsWith('../')) {
    if (!importer) return undefined;
    return path.resolve(path.dirname(importer), clean);
  }
  return undefined;
}

/**
 * Files under contentDir that are META, not content data, so the direct-import
 * guard must let them through:
 *  - the Zod `schemas` module — imported by the virtual module + the eager
 *    validator (`validateContentEager` via `ssrLoadModule`). The two hooks see
 *    it differently: `resolveId` gets the extensionless project-root-relative
 *    path (`/src/content/schemas`), `load` gets the resolved id (`.../schemas.ts`).
 *  - any type-declaration file (`*.d.ts`, e.g. the generated `virtual-content.d.ts`
 *    that `content_scaffold` emits into contentDir) — type-only, never a runtime
 *    import, so blocking it is always wrong.
 * Match by the contentDir-relative name so neither hook blocks them.
 */
function isContentMetaModule(resolvedPath: string, contentDir: string): boolean {
  const rel = path.relative(contentDir, resolvedPath);
  return rel === 'schemas' || rel === 'schemas.ts' || rel.endsWith('.d.ts');
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return false;
  }
}
