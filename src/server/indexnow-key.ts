import { existsSync, readFileSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";

const INDEXNOW_KEY_FILENAME = "airo-indexnow.json";

interface IndexNowKeyManifest {
	key: string;
}

function isIndexNowKeyManifest(value: unknown): value is IndexNowKeyManifest {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<IndexNowKeyManifest>;
	return typeof candidate.key === "string" && /^[a-f0-9]{32}$/.test(candidate.key);
}

export function loadIndexNowKey(baseDir: string): string | null {
	if (baseDir.includes("\0")) return null;
	if (baseDir.split(/[\\/]+/).includes("..")) return null;
	const normalizedBaseDir = normalize(baseDir);
	const resolvedBaseDir = resolve(normalizedBaseDir);
	const resolvedManifestPath = resolve(resolvedBaseDir, INDEXNOW_KEY_FILENAME);
	const basePrefix = resolvedBaseDir.endsWith(sep) ? resolvedBaseDir : `${resolvedBaseDir}${sep}`;
	if (resolvedManifestPath !== resolvedBaseDir && !resolvedManifestPath.startsWith(basePrefix)) {
		return null;
	}

	if (!existsSync(resolvedManifestPath)) return null;

	try {
		const parsed = JSON.parse(readFileSync(resolvedManifestPath, "utf8")) as unknown;
		if (!isIndexNowKeyManifest(parsed)) return null;
		return parsed.key;
	} catch {
		return null;
	}
}
