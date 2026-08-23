import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";





import { formatOverridesPlugin } from "./export-plugins/format-overrides-plugin.ts";
import { contentPlugin } from "./export-plugins/content-plugin/index.ts";import { mediaAssetsPlugin } from "./export-plugins/media-assets-plugin.ts";

function extractHostname(value: string): string {
  try {
    if (value.includes("://")) {
      return new URL(value).hostname;
    }
    return value;
  } catch {
    return value;
  }
}

function apiDevPlugin(): Plugin {
  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        try {
          const mod = await server.ssrLoadModule("/src/server/entry.ts");
          const handler = mod.default;
          handler(req, res, next);
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          next(err);
        }
      });
    }
  };
}

/**
 * Rewrites named imports from CJS-only packages to default-import +
 * destructure during Vite SSR dev (ssrLoadModule). In dev, Vite externalizes
 * deps to Node's require() which returns a CJS namespace where named exports
 * are unavailable. The production build (noExternal:true) bundles via Rollup
 * which handles interop natively, so this transform is dev-only.
 */
function ssrCjsCompatPlugin(): Plugin {
  const CJS_PACKAGES: string[] = ["react-router-dom", "react-router"];

  function rewriteNames(raw: string): string {
    return raw.
    split(",").
    map((s: string) => s.trim()).
    filter((s: string) => s && !s.startsWith("type ")).
    map((s: string) => s.replace(/^(\S+)\s+as\s+(\S+)$/, "$1: $2")).
    join(", ");
  }

  return {
    name: "ssr-cjs-compat",
    apply: "serve",
    transform(code: string, id: string, options?: {ssr?: boolean;}) {
      if (!options?.ssr) return;
      let transformed: string = code;
      for (const pkg of CJS_PACKAGES) {
        const re = new RegExp(
          `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${pkg}['"]`,
          "g"
        );
        transformed = transformed.replace(re, (_match: string, names: string) => {
          const alias: string = pkg.replace(/[^a-zA-Z]/g, "_");
          const destructured: string = rewriteNames(names);
          if (!destructured) return `import ${alias} from '${pkg}'`;
          return `import ${alias} from '${pkg}';\nconst {${destructured}} = ${alias}`;
        });
      }
      if (transformed === code) return;
      return { code: transformed, map: null };
    }
  };
}

/**
 * Serves the pre-built output of an automation worktree when the
 * X-Worktree-Root header is present. Enables automation scan tools to
 * verify rendered HTML without affecting the user's live preview.
 *
 * Flow: dev-supervisor injects the header on requests carrying X-Base-Dir.
 * When the worktree has been built (dist/client/index.html exists), this
 * plugin serves the production build. Otherwise returns 503 so the
 * automation knows a build is needed first.
 */
const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json"
};

function worktreePreviewPlugin(): Plugin {
  const serverBundleCache = new Map<string, {app: unknown;mtimeMs: number;}>();

  return {
    name: "worktree-preview",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const worktreeRoot = req.headers["x-worktree-root"] as string | undefined;
        if (!worktreeRoot) return next();

        const clientDir = path.join(worktreeRoot, "dist", "client");
        const indexPath = path.join(clientDir, "index.html");

        if (!existsSync(indexPath)) {
          res.setHeader("X-Worktree-Status", "not-built");
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "Worktree build not found. Run vite build first." }));
          return;
        }

        const url = req.url || "/";

        const ext = path.extname(url.split("?")[0] || "");
        if (ext && ext !== ".html") {
          const assetPath = path.resolve(clientDir, "." + (url.split("?")[0] || ""));
          if (assetPath.startsWith(clientDir + path.sep) && existsSync(assetPath)) {
            res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
            res.end(await readFile(assetPath));
            return;
          }
        }

        const bundlePath = path.join(worktreeRoot, "dist", "server.bundle.mjs");
        if (!existsSync(bundlePath)) {
          res.setHeader("Content-Type", "text/html");
          res.end(await readFile(indexPath, "utf-8"));
          return;
        }

        try {
          const bundleMtime: number = statSync(bundlePath).mtimeMs;
          let cached = serverBundleCache.get(worktreeRoot);
          if (!cached || cached.mtimeMs < bundleMtime) {
            const cacheBuster: string = `?t=${bundleMtime}`;
            const mod = await import(/* @vite-ignore */`${bundlePath}${cacheBuster}`);
            cached = { app: mod.default, mtimeMs: bundleMtime };
            serverBundleCache.set(worktreeRoot, cached);
          }

          const app = cached.app as (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void)
          => void;

          app(req, res, () => {
            readFile(indexPath, "utf-8").then((html) => {
              res.setHeader("Content-Type", "text/html");
              res.end(html);
            }).catch(() => {
              res.statusCode = 500;
              res.end("Failed to read index.html");
            });
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Worktree server bundle failed: ${message}` }));
        }
      });
    }
  };
}

/**
 * SSR dev middleware accessible via path prefix. Enables automation tools to
 * fetch server-rendered HTML without relying on headers that proxies may strip.
 *
 * /__ssr/preview/*         — live SSR from current source (ssrLoadModule)
 * /__ssr/worktree/{id}/*   — SSR from a pre-built automation worktree
 */
function ssrDevPlugin(): Plugin {
  const worktreeBundleCache = new Map<string, {app: unknown;mtimeMs: number;}>();

  async function renderFromSource(
  server: ViteDevServer,
  routePath: string,
  req: IncomingMessage,
  res: ServerResponse)
  : Promise<void> {
    try {
      const mod = await server.ssrLoadModule("/src/entry-server.tsx");
      const renderFn = mod.render as (url: string) => Promise<{
        html: string;
        head: string;
        status: number;
        redirect?: string;
      }>;
      const result = await renderFn(routePath);

      if (result.redirect) {
        res.statusCode = result.status;
        res.setHeader("Location", result.redirect);
        res.end();
        return;
      }

      const template: string = await readFile(
        path.resolve(__dirname, "index.html"),
        "utf-8"
      );
      const html: string = template.
      replace("<!--app-head-->", result.head).
      replace("<!--app-html-->", result.html);

      res.statusCode = result.status;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } catch (err) {
      if (err instanceof Error) server.ssrFixStacktrace(err);
      const message = err instanceof Error ? err.message : String(err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: `SSR render failed: ${message}` }));
    }
  }

  async function renderFromWorktreeBuild(
  runId: string,
  routePath: string,
  req: IncomingMessage,
  res: ServerResponse)
  : Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(runId)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid worktree runId" }));
      return;
    }

    const worktreeRoot: string = `/tmp/auto-${runId}`;
    const clientDir: string = path.join(worktreeRoot, "dist", "client");
    const indexPath: string = path.join(clientDir, "index.html");

    if (!existsSync(indexPath)) {
      res.setHeader("X-Worktree-Status", "not-built");
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "Worktree build not found. Run vite build first." }));
      return;
    }

    const ext: string = path.extname(routePath.split("?")[0] || "");
    if (ext && ext !== ".html") {
      const assetPath: string = path.resolve(clientDir, "." + routePath.split("?")[0]);
      if (assetPath.startsWith(clientDir + path.sep) && existsSync(assetPath)) {
        res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
        res.end(await readFile(assetPath));
        return;
      }
    }

    const bundlePath: string = path.join(worktreeRoot, "dist", "server.bundle.mjs");
    if (!existsSync(bundlePath)) {
      res.setHeader("Content-Type", "text/html");
      res.end(await readFile(indexPath, "utf-8"));
      return;
    }

    try {
      const bundleMtime: number = statSync(bundlePath).mtimeMs;
      let cached = worktreeBundleCache.get(worktreeRoot);
      if (!cached || cached.mtimeMs < bundleMtime) {
        const cacheBuster: string = `?t=${bundleMtime}`;
        const mod = await import(/* @vite-ignore */`${bundlePath}${cacheBuster}`);
        cached = { app: mod.default, mtimeMs: bundleMtime };
        worktreeBundleCache.set(worktreeRoot, cached);
      }

      const app = cached.app as (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void)
      => void;

      // Rewrite req.url to the actual route path so the Express app routes correctly
      const originalUrl: string | undefined = req.url;
      req.url = routePath;
      app(req, res, () => {
        req.url = originalUrl;
        readFile(indexPath, "utf-8").then((html) => {
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        }).catch(() => {
          res.statusCode = 500;
          res.end("Failed to read index.html");
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: `Worktree server bundle failed: ${message}` }));
    }
  }

  return {
    name: "ssr-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url: string = req.url || "";
        if (!url.startsWith("/__ssr/")) return next();

        const stripped: string = url.slice("/__ssr/".length);

        if (stripped.startsWith("preview") && (stripped.length === 7 || stripped[7] === "/")) {
          const routePath: string = stripped.length <= 8 ? "/" : "/" + stripped.slice(8).split("?")[0];
          await renderFromSource(server, routePath, req, res);
        } else if (stripped.startsWith("worktree/")) {
          const rest: string = stripped.slice("worktree/".length);
          const slashIdx: number = rest.indexOf("/");
          const runId: string = slashIdx === -1 ? rest.split("?")[0] : rest.slice(0, slashIdx);
          const routePath: string = slashIdx === -1 ? "/" : "/" + rest.slice(slashIdx + 1).split("?")[0];
          await renderFromWorktreeBuild(runId, routePath, req, res);
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Unknown /__ssr/ variant" }));
        }
      });
    }
  };
}

const allowedHosts: string[] = [];
const corsOrigins: string[] = [];

if (process.env.FRONTEND_DOMAIN) {
  const frontendHost = extractHostname(process.env.FRONTEND_DOMAIN);
  allowedHosts.push(frontendHost);
  corsOrigins.push(`http://${frontendHost}`, `https://${frontendHost}`);
}
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(",");
  allowedHosts.push(...origins.map(extractHostname));
  corsOrigins.push(...origins);
}
if (process.env.VITE_PARENT_ORIGIN) {
  allowedHosts.push(extractHostname(process.env.VITE_PARENT_ORIGIN));
  corsOrigins.push(process.env.VITE_PARENT_ORIGIN);
}
if (allowedHosts.length === 0) {
  allowedHosts.push("*");
}
if (corsOrigins.length === 0) {
  corsOrigins.push("*");
}

export default defineConfig(({ mode, isSsrBuild }) => ({
  envPrefix: ["VITE_", "SITE_"],

  plugins: [
  react({
    babel: {
      plugins: []
    }
  }),
  ssrCjsCompatPlugin(),
  ssrDevPlugin(),
  worktreePreviewPlugin(),
  apiDevPlugin(), mediaAssetsPlugin(),
  formatOverridesPlugin(__dirname),
  contentPlugin()],










  resolve: {
    dedupe: ["react", "react-dom", "react-router"],
    alias: {
      nothing: "/src/fallbacks/missingModule.ts",
      "@/api": path.resolve(__dirname, "./src/server/api"),
      "@": path.resolve(__dirname, "./src")
    }
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router", "motion/react"]
  },

  ssr: {
    noExternal: isSsrBuild ? true : undefined
  },

  server: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    },
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/dist/**"]
    },
    // Pre-transform the entry chain on dev-server start so the FIRST iframe
    // request doesn't pay the full cold on-demand transpile cost. Paired with
    // the container's pre-start `vite optimize` (container-scripts/preview/
    // nomad_setup.sh), this shrinks the mount→IFRAME_READY window that the
    // builder's recovery logic waits on.
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"]
    }
  },

  preview: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    }
  },

  build: isSsrBuild ?
  {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    ssr: "src/server/entry.ts",
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "server.bundle.mjs",
        chunkFileNames: "bin/[name]-[hash].js",
        banner: "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);"
      }
    }
  } :
  {
    outDir: "dist/client",
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "radix-ui": [
          "@radix-ui/react-accordion",
          "@radix-ui/react-alert-dialog",
          "@radix-ui/react-aspect-ratio",
          "@radix-ui/react-avatar",
          "@radix-ui/react-checkbox",
          "@radix-ui/react-collapsible",
          "@radix-ui/react-context-menu",
          "@radix-ui/react-dialog",
          "@radix-ui/react-dropdown-menu",
          "@radix-ui/react-hover-card",
          "@radix-ui/react-label",
          "@radix-ui/react-menubar",
          "@radix-ui/react-navigation-menu",
          "@radix-ui/react-popover",
          "@radix-ui/react-progress",
          "@radix-ui/react-scroll-area",
          "@radix-ui/react-select",
          "@radix-ui/react-separator",
          "@radix-ui/react-slider",
          "@radix-ui/react-slot",
          "@radix-ui/react-switch",
          "@radix-ui/react-tabs",
          "@radix-ui/react-toast",
          "@radix-ui/react-toggle",
          "@radix-ui/react-toggle-group",
          "@radix-ui/react-tooltip"],

          query: ["@tanstack/react-query"]
        }
      }
    }
  }
}));