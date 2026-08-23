import { parseFrontmatter, type ParsedMarkdown } from './frontmatter.js';

export const CONTENT_SUBDIRS = ['pages', 'data'] as const;
export type ContentSubdir = (typeof CONTENT_SUBDIRS)[number];

export const RESERVED_ROOTS: ReadonlySet<string> = new Set(['site', 'pages', 'data']);

/** True when `value` names one of the content subdirectories. */
export function isContentSubdir(value: string): value is ContentSubdir {
  return (CONTENT_SUBDIRS as readonly string[]).includes(value);
}

// JS reserved words and strict-mode future reserved words that would produce
// invalid `export const <key> = …` syntax if used as content keys.
const JS_RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'let', 'new', 'null', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'enum', 'await',
]);

/** A discovered entry, independent of how it was read off disk. */
export interface KeyedEntry {
  readonly canonicalKey: string;
  readonly bareName: string;
  readonly subdir: ContentSubdir | null;
  readonly kind: 'file' | 'collection';
  readonly relPath: string;
}

/**
 * A parsed content key. `root: null` means the key arrived bare (`home.hero`) — the shape every
 * shipped app and every stored `.user-edits.json` lock still uses. Bare keys name a file only via
 * the alias set, so they resolve through discovery rather than `candidatePathsFor`.
 */
export type ParsedCanonicalKey =
  | { root: 'site'; bareName: 'site'; path: string[] }
  | { root: ContentSubdir; bareName: string; path: string[] }
  | { root: null; bareName: string; path: string[] }
  | { error: 'invalid-key'; message: string };

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function canonicalKeyFor(subdir: ContentSubdir | null, bareName: string): string {
  if (subdir === null) return bareName;
  return `${subdir}.${bareName}`;
}

export function parseCanonicalKey(key: string): ParsedCanonicalKey {
  if (key.length === 0) {
    return { error: 'invalid-key', message: 'content key must not be empty' };
  }

  const segments: string[] = key.split('.');
  const [first, second, ...rest]: string[] = segments;

  if (first === 'site') {
    return { root: 'site', bareName: 'site', path: segments.slice(1) };
  }
  if (isContentSubdir(first) && second !== undefined) {
    return { root: first, bareName: second, path: rest };
  }

  if (!IDENTIFIER.test(first)) {
    return { error: 'invalid-key', message: `content key "${key}" has an invalid root segment` };
  }
  return { root: null, bareName: first, path: segments.slice(1) };
}

/** The subset of a directory entry the layout rules need, so callers can supply any IO source. */
export interface DirentLike {
  readonly name: string;
  readonly isDirectory: boolean;
}

const COLLECTION_ITEM = /\.(json|md)$/;

/** True for a file a collection directory contributes as an item. */
export function isCollectionItem(filename: string): boolean {
  if (filename.startsWith('.') || filename === 'README.md') return false;
  return COLLECTION_ITEM.test(filename);
}

/**
 * Apply the content layout rules to one subdirectory's entries: `<name>.json` is a page or data
 * file, a directory under `data/` is a collection, and everything else — including a directory
 * under `pages/` — is ignored. A `.json`-named directory is reported as a file so the caller
 * surfaces its own read error rather than inventing a collection key containing a dot.
 */
export function classifyDirents(
  subdir: ContentSubdir,
  dirents: readonly DirentLike[],
): KeyedEntry[] {
  const entries: KeyedEntry[] = [];
  for (const dirent of dirents) {
    if (dirent.name.endsWith('.json')) {
      const bareName: string = dirent.name.slice(0, -'.json'.length);
      entries.push({
        canonicalKey: canonicalKeyFor(subdir, bareName),
        bareName,
        subdir,
        kind: 'file',
        relPath: `${subdir}/${dirent.name}`,
      });
    } else if (dirent.isDirectory && subdir === 'data') {
      entries.push({
        canonicalKey: canonicalKeyFor(subdir, dirent.name),
        bareName: dirent.name,
        subdir,
        kind: 'collection',
        relPath: `${subdir}/${dirent.name}`,
      });
    }
  }
  return entries;
}

/**
 * The shape one collection item contributes, from its filename and raw contents.
 *
 * Both the emitted module and the generated `.d.ts` must agree on this, so it lives here rather
 * than being re-derived: a second JSON-only parse path declared `unknown[]` for the `.md` posts
 * that are the blog's default format, and omitted the `slug` this injects from the filename.
 */
export function normalizeCollectionItem(filename: string, raw: string): Record<string, unknown> {
  const slug: string = filename.replace(/\.(md|json)$/, '');
  if (filename.endsWith('.md')) {
    const { data, content }: ParsedMarkdown = parseFrontmatter(raw);
    return { slug, ...data, content };
  }
  return { slug, ...(JSON.parse(raw) as Record<string, unknown>) };
}

/** Inverse of discovery: the on-disk candidates a canonical key may name. */
export function candidatePathsFor(key: string): { relPaths: string[] } | { error: string } {
  const parsed: ParsedCanonicalKey = parseCanonicalKey(key);
  if ('error' in parsed) return parsed;

  if (parsed.root === 'site') {
    return { relPaths: ['site.json'] };
  }
  if (parsed.root === null) {
    return {
      error: `bare content key "${key}" names a file only through the alias set — resolve it by discovery`,
    };
  }

  const filePath: string = `${parsed.root}/${parsed.bareName}.json`;
  if (parsed.root === 'data') {
    return { relPaths: [filePath, `data/${parsed.bareName}`] };
  }
  return { relPaths: [filePath] };
}

/**
 * Bare names an emitter may declare as `export const <name>`: unambiguous AND legal as a binding.
 * An emitter must use this rather than composing the reserved-word check itself — composing it
 * separately is how the virtual module and the generated `.d.ts` came to disagree, putting
 * `export const new` into a `.d.ts` and breaking the customer app's typecheck.
 */
export function exportableAliasNames(entries: readonly KeyedEntry[]): ReadonlySet<string> {
  const result: Set<string> = new Set();
  for (const name of aliasableNames(entries)) {
    if (!isJsReservedWord(name)) result.add(name);
  }
  return result;
}

/**
 * Bare names claimed by exactly one entry. This is the RESOLUTION set — wider than
 * {@link exportableAliasNames}, because a stored key or lock may name an entry that never got an
 * export binding, and resolving it is still unambiguous.
 */
export function aliasableNames(entries: readonly KeyedEntry[]): ReadonlySet<string> {
  const counts: Map<string, number> = new Map();
  for (const entry of entries) {
    counts.set(entry.bareName, (counts.get(entry.bareName) ?? 0) + 1);
  }

  const result: Set<string> = new Set();
  for (const [name, count] of counts) {
    if (count === 1 && !RESERVED_ROOTS.has(name)) result.add(name);
  }
  return result;
}

/** Same-namespace duplicates (data/blog.json vs data/blog/) — still fatal. */
export function findFatalDuplicates(entries: readonly KeyedEntry[]): Array<[KeyedEntry, KeyedEntry]> {
  const byCanonicalKey: Map<string, KeyedEntry[]> = new Map();
  for (const entry of entries) {
    const group: KeyedEntry[] = byCanonicalKey.get(entry.canonicalKey) ?? [];
    group.push(entry);
    byCanonicalKey.set(entry.canonicalKey, group);
  }

  const pairs: Array<[KeyedEntry, KeyedEntry]> = [];
  for (const group of byCanonicalKey.values()) {
    for (let i: number = 1; i < group.length; i += 1) {
      pairs.push([group[0], group[i]]);
    }
  }
  return pairs;
}

/**
 * Throws for a name no content file may use, whether or not it gets a bare alias: one that is not
 * a JS identifier, or one of the reserved namespace roots `site` / `pages` / `data`.
 *
 * The Vite plugin does not consult this yet — it still carries its own `assertSafeKey`, which has
 * no reserved-root rule. That divergence is intentional for now: consolidating the plugin onto
 * these rules changes what `virtual:content` emits, so it lands separately. Until then this module
 * is consumed only by the agent-side write-back resolver.
 *
 * The identifier rule still applies to nested keys even though object properties could hold a
 * hyphen or space: a non-identifier name is unquotable in the generated `.d.ts` and unreachable by
 * source-mapper attribution, so it would render while being silently uneditable.
 *
 * Throwing on a reserved root is a deliberate break for apps that predate the rule. The agent's
 * write-back resolver keeps a tolerant fallback for the window before this reaches an app; see
 * `resolveContentFile` in `agents/src/tools/content-editor.ts`.
 */
export function assertSafeContentName(name: string, filename: string): void {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`[airo-content] invalid content key "${name}" from "${filename}" — must be a valid JS identifier`);
  }
  if (RESERVED_ROOTS.has(name)) {
    throw new Error(
      `[airo-content] reserved content key "${name}" from "${filename}" — ` +
      `"${name}" is reserved for the ${name} namespace export and cannot be used as a content file name. ` +
      `Rename the file to avoid shadowing the generated virtual module.`,
    );
  }
}

/** True when `name` is a JS reserved word, so it cannot be a top-level export binding. */
export function isJsReservedWord(name: string): boolean {
  return JS_RESERVED_WORDS.has(name);
}

/**
 * Throws for a name that cannot be a top-level export. Adds the JS-reserved-word rule on top of
 * {@link assertSafeContentName} — reserved words are legal as nested keys (`pages.new`) and only
 * fail as a bare alias, so callers emitting an alias use this and discovery uses the looser check.
 */
export function assertSafeExportName(name: string, filename: string): void {
  assertSafeContentName(name, filename);
  if (JS_RESERVED_WORDS.has(name)) {
    throw new Error(
      `[airo-content] reserved content key "${name}" from "${filename}" — ` +
      `"${name}" is a JS reserved word and cannot be used as an export name. ` +
      `Rename the file to avoid a syntax error in the emitted virtual module.`,
    );
  }
}
