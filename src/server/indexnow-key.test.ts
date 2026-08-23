import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadIndexNowKey } from "./indexnow-key";

const VALID_KEY = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

let tmpDir: string;

describe("loadIndexNowKey", () => {
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "indexnow-test-"));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns the key from a valid manifest", () => {
		writeFileSync(join(tmpDir, "airo-indexnow.json"), JSON.stringify({ key: VALID_KEY }));
		expect(loadIndexNowKey(tmpDir)).toBe(VALID_KEY);
	});

	it("returns null when the file does not exist", () => {
		expect(loadIndexNowKey(tmpDir)).toBeNull();
	});

	it("returns null when JSON is malformed", () => {
		writeFileSync(join(tmpDir, "airo-indexnow.json"), "not json");
		expect(loadIndexNowKey(tmpDir)).toBeNull();
	});

	it("returns null when key is missing from manifest", () => {
		writeFileSync(join(tmpDir, "airo-indexnow.json"), JSON.stringify({}));
		expect(loadIndexNowKey(tmpDir)).toBeNull();
	});

	it("returns null when key is not a 32-char hex string", () => {
		writeFileSync(join(tmpDir, "airo-indexnow.json"), JSON.stringify({ key: "tooshort" }));
		expect(loadIndexNowKey(tmpDir)).toBeNull();
	});

	it("returns null when key contains non-hex characters", () => {
		writeFileSync(join(tmpDir, "airo-indexnow.json"), JSON.stringify({ key: "z1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" }));
		expect(loadIndexNowKey(tmpDir)).toBeNull();
	});

	it("returns null for path traversal via null byte", () => {
		expect(loadIndexNowKey(`${tmpDir}\0evil`)).toBeNull();
	});

	it("returns null for path traversal via .. segment", () => {
		expect(loadIndexNowKey(`${tmpDir}/../etc`)).toBeNull();
	});
});
