/**
 * Lightweight YAML-frontmatter parser — no deps. Ported from the former blog
 * skill loader (agents/src/skills/blog/templates/lib/frontmatter.ts — that
 * sibling still exists but is no longer the canonical source; this copy is
 * independently maintained for the build-time content-plugin). Retyped to
 * avoid `any`.
 */
export interface ParsedMarkdown {
  data: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(markdown: string): ParsedMarkdown {
  // Requires a newline after the closing ---; a file ending exactly at --- with no trailing newline falls back to { data: {}, content: <whole file> }
  const frontmatterRegex: RegExp = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match: RegExpMatchArray | null = markdown.match(frontmatterRegex);
  if (!match) return { data: {}, content: markdown };

  const frontmatterText: string = match[1];
  const body: string = match[2];
  const data: Record<string, unknown> = {};

  for (const line of frontmatterText.split('\n')) {
    const colonIndex: number = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key: string = line.slice(0, colonIndex).trim();
    let value: string = line.slice(colonIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      data[key] = value;
      continue;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((item: string): string => item.trim().replace(/^["']|["']$/g, ''))
        .filter((item: string): boolean => item.length > 0);
      continue;
    }
    if (value === 'true') { data[key] = true; continue; }
    if (value === 'false') { data[key] = false; continue; }
    if (value !== '' && !Number.isNaN(Number(value))) { data[key] = Number(value); continue; }
    data[key] = value;
  }

  return { data, content: body.trim() };
}
