import type { Request, Response } from "express";
import type { SeoRoute } from "../lib/seo-routes";
import { seoRoutes } from "../lib/seo-routes";
import { siteMeta } from "../lib/site-meta";
import { isSystemHost } from "./seo-host";

/**
 * Convert an SEO route path into a human-readable link label.
 *
 * Rule:
 *  - "/"            -> "Home" (special case)
 *  - otherwise      -> last path segment, split on "-"/"_", title-cased.
 *    e.g. "/about" -> "About", "/contact-us" -> "Contact Us",
 *    "/blog/my-post" -> "My Post".
 * seoRoutes paths are static route paths (no query strings/fragments), so
 * those are not handled.
 */
export function humanizeLabel(path: string): string {
	if (path === "/") return "Home";
	const segment = path.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
	return segment
		.split(/[-_]/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Make agent/customer-authored text safe to interpolate into markdown.
 * name/summary ultimately trace to customer-supplied business details, so
 * they may contain markdown-structural characters or newlines that would
 * break the H1, blockquote, or link syntax. We collapse newlines/whitespace
 * to single spaces (keeping H1 and blockquote single-line) and backslash-
 * escape the characters that break inline constructs (`\`, backtick, `[`,
 * `]`). Other characters (#, >, *, etc.) are not structural mid-line, so we
 * leave them to avoid mangling ordinary business names.
 */
export function sanitizeMarkdown(text: string): string {
	return text
		.replace(/[\r\n\t]+/g, " ")
		.replace(/[\\`[\]]/g, (c) => `\\${c}`)
		.replace(/ {2,}/g, " ")
		.trim();
}

export interface RenderLlmsTxtOptions {
	/** Absolute origin, e.g. "https://acme.com". */
	baseUrl: string;
	/** Bare hostname, e.g. "acme.com" — used for the H1 fallback. */
	hostname: string;
	/** Business name (may be empty when unseeded). */
	name: string;
	/** Business summary (may be empty when unseeded). */
	summary: string;
	/** Crawlable routes; the page list is built from these. */
	routes: SeoRoute[];
}

/**
 * Render the /llms.txt body. Pure: no request, no I/O. Always returns a
 * well-formed, single-trailing-newline markdown document.
 */
export function renderLlmsTxt(opts: RenderLlmsTxtOptions): string {
	const name = sanitizeMarkdown(opts.name);
	const summary = sanitizeMarkdown(opts.summary);

	const lines: string[] = [`# ${name || opts.hostname}`];

	if (summary) {
		lines.push("", `> ${summary}`);
	}

	const pageLinks = opts.routes
		.filter((r) => typeof r.path === "string" && r.path.startsWith("/"))
		.map(
			(r) =>
				`- [${sanitizeMarkdown(humanizeLabel(r.path))}](${opts.baseUrl}${r.path})`,
		);

	if (pageLinks.length > 0) {
		lines.push("", "## Pages", ...pageLinks);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Express handler for GET /llms.txt. Host-gated like robots.txt / sitemap.xml:
 * system/preview hosts get a 404 (no real published site to describe);
 * customer-attached domains get the rendered file. Headers mirror the other
 * SEO routes so CDN behaviour is identical (per-host via `Vary: Host`).
 */
export function llmsTxtHandler(req: Request, res: Response): void {
	if (isSystemHost(req)) {
		res
			.status(404)
			.type("text/plain")
			.set("Cache-Control", "public, max-age=60, must-revalidate")
			.set("Vary", "Host")
			.send("Not found\n");
		return;
	}
	const body = renderLlmsTxt({
		baseUrl: `${req.protocol}://${req.hostname}`,
		hostname: req.hostname,
		name: siteMeta.name,
		summary: siteMeta.summary,
		routes: seoRoutes,
	});
	res
		.type("text/plain")
		.set("Cache-Control", "public, max-age=60, must-revalidate")
		.set("Vary", "Host")
		.send(body);
}
