import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { humanizeLabel, sanitizeMarkdown, renderLlmsTxt, llmsTxtHandler } from "./llms-txt";
import type { SeoRoute } from "../lib/seo-routes";

describe("humanizeLabel", () => {
	it("special-cases the homepage", () => {
		expect(humanizeLabel("/")).toBe("Home");
	});

	it("title-cases a single segment", () => {
		expect(humanizeLabel("/about")).toBe("About");
	});

	it("splits hyphens and underscores into words", () => {
		expect(humanizeLabel("/contact-us")).toBe("Contact Us");
		expect(humanizeLabel("/our_team")).toBe("Our Team");
	});

	it("uses the last segment of a nested path", () => {
		expect(humanizeLabel("/blog/my-post")).toBe("My Post");
	});

	it("ignores a trailing slash", () => {
		expect(humanizeLabel("/services/")).toBe("Services");
	});
});

describe("sanitizeMarkdown", () => {
	it("leaves ordinary business text untouched", () => {
		expect(sanitizeMarkdown("Mary's Cleaning Co.")).toBe("Mary's Cleaning Co.");
	});

	it("escapes link-breaking and code characters", () => {
		expect(sanitizeMarkdown("Acme [Inc]")).toBe("Acme \\[Inc\\]");
		expect(sanitizeMarkdown("use `code` here")).toBe("use \\`code\\` here");
	});

	it("collapses newlines and runs of whitespace to single spaces", () => {
		expect(sanitizeMarkdown("line one\nline two")).toBe("line one line two");
		expect(sanitizeMarkdown("  spaced   out \t")).toBe("spaced out");
	});
});

describe("renderLlmsTxt", () => {
	const routes: SeoRoute[] = [
		{ path: "/", changefreq: "weekly", priority: 1.0 },
		{ path: "/about" },
	];

	it("renders H1, blockquote, and a Pages link list when seeded", () => {
		const out = renderLlmsTxt({
			baseUrl: "https://acme.com",
			hostname: "acme.com",
			name: "Acme",
			summary: "We sell quality desks",
			routes,
		});
		expect(out).toBe(
			"# Acme\n\n> We sell quality desks\n\n## Pages\n" +
				"- [Home](https://acme.com/)\n" +
				"- [About](https://acme.com/about)\n",
		);
	});

	it("falls back to the hostname H1 and omits the blockquote when unseeded", () => {
		const out = renderLlmsTxt({
			baseUrl: "https://acme.com",
			hostname: "acme.com",
			name: "",
			summary: "",
			routes: [{ path: "/" }],
		});
		expect(out).toBe("# acme.com\n\n## Pages\n- [Home](https://acme.com/)\n");
	});

	it("omits the Pages heading entirely when there are no routes", () => {
		const out = renderLlmsTxt({
			baseUrl: "https://acme.com",
			hostname: "acme.com",
			name: "Acme",
			summary: "Hi",
			routes: [],
		});
		expect(out).toBe("# Acme\n\n> Hi\n");
	});

	it("skips routes whose path does not start with a slash", () => {
		const out = renderLlmsTxt({
			baseUrl: "https://acme.com",
			hostname: "acme.com",
			name: "Acme",
			summary: "Hi",
			routes: [{ path: "/" }, { path: "mailto:x@y.com" } as SeoRoute],
		});
		expect(out).toBe("# Acme\n\n> Hi\n\n## Pages\n- [Home](https://acme.com/)\n");
	});

	it("sanitizes a name with markdown-significant characters", () => {
		const out = renderLlmsTxt({
			baseUrl: "https://acme.com",
			hostname: "acme.com",
			name: "Acme [Inc]",
			summary: "Line\nbreak",
			routes: [],
		});
		expect(out).toBe("# Acme \\[Inc\\]\n\n> Line break\n");
	});
});

/**
 * Minimal chainable Express res stand-in that records what the handler set.
 * Avoids adding supertest; matches the pure-function test style used across
 * this template (see seo-host.test.ts).
 */
function mockRes() {
	const calls: {
		status?: number;
		contentType?: string;
		headers: Record<string, string>;
		body?: string;
	} = { headers: {} };
	const res = {
		status(code: number) {
			calls.status = code;
			return res;
		},
		type(t: string) {
			calls.contentType = t;
			return res;
		},
		set(key: string, value: string) {
			calls.headers[key] = value;
			return res;
		},
		send(body: string) {
			calls.body = body;
			return res;
		},
	};
	return { res: res as unknown as Response, calls };
}

function reqFor(hostname: string): Request {
	return { protocol: "https", hostname } as unknown as Request;
}

describe("llmsTxtHandler", () => {
	it("returns 404 on a system/preview host", () => {
		const { res, calls } = mockRes();
		llmsTxtHandler(reqFor("preview.airoapp.ai"), res);
		expect(calls.status).toBe(404);
		expect(calls.body).toBe("Not found\n");
	});

	it("serves a well-formed file with the right headers on a customer host", () => {
		const { res, calls } = mockRes();
		llmsTxtHandler(reqFor("acme.com"), res);
		// Default siteMeta is unseeded, so H1 falls back to the hostname and
		// the default seoRoutes ("/") produces a single Home link.
		expect(calls.status).toBeUndefined(); // no explicit status => Express 200
		expect(calls.contentType).toBe("text/plain");
		expect(calls.headers["Cache-Control"]).toBe(
			"public, max-age=60, must-revalidate",
		);
		expect(calls.headers["Vary"]).toBe("Host");
		expect(calls.body).toContain("# acme.com");
		expect(calls.body).toContain("## Pages");
		expect(calls.body).toContain("- [Home](https://acme.com/)");
	});
});
