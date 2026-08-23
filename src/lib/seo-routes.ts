/**
 * Auto-synced registry of publicly-crawlable routes. Consumed by the
 * /sitemap.xml handler in src/server/entry.ts.
 *
 * DO NOT add or remove paths by hand. Static paths are mirrored here from
 * src/routes.tsx automatically whenever that file is edited (any manual
 * path edit would be overwritten on the next routes.tsx change). For sync
 * to pick up a route, its `path` must be a literal string starting with "/";
 * template literals and identifier refs are skipped, and dynamic-param routes
 * like "/products/:id" are excluded.
 *
 * The only fields safe to hand-edit are the per-entry metadata below, after a
 * sync:
 * - `priority` (0.0–1.0): Home = 1.0, main sections = 0.8, deep pages = 0.5.
 * - `changefreq` and `lastmod`.
 */

export interface SeoRoute {
  path: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  lastmod?: string;
}

export const seoRoutes: SeoRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/get-started", changefreq: "monthly", priority: 0.8 },
  { path: "/login", changefreq: "monthly", priority: 0.8 },
  { path: "/register", changefreq: "monthly", priority: 0.8 },
  { path: "/dashboard", changefreq: "monthly", priority: 0.8 },
  { path: "/courses", changefreq: "monthly", priority: 0.8 },
  { path: "/ai-tutor", changefreq: "monthly", priority: 0.8 },
  { path: "/quizzes", changefreq: "monthly", priority: 0.8 },
  { path: "/flashcards", changefreq: "monthly", priority: 0.8 },
  { path: "/videos", changefreq: "monthly", priority: 0.8 },
  { path: "/planner", changefreq: "monthly", priority: 0.8 },
  { path: "/analytics", changefreq: "monthly", priority: 0.8 },
  { path: "/forum", changefreq: "monthly", priority: 0.8 },
  { path: "/lecturer", changefreq: "monthly", priority: 0.8 },
  { path: "/lecturer/courses", changefreq: "monthly", priority: 0.5 },
  { path: "/lecturer/engagement", changefreq: "monthly", priority: 0.5 },
  { path: "/admin", changefreq: "monthly", priority: 0.8 },
  { path: "/admin/users", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/courses", changefreq: "monthly", priority: 0.5 },
  { path: "/admin/settings", changefreq: "monthly", priority: 0.5 },
];
