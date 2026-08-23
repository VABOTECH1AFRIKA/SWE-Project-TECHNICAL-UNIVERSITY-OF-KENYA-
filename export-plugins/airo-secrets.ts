/**
 * Standalone stub for #airo/secrets in exported AAB projects.
 *
 * In production AAB containers, getSecret reads from the Nomad task-local
 * config.json injected by dev-supervisor. Outside AAB (downloaded projects,
 * GitHub CI), secrets are resolved from environment variables so skills
 * (stripe, auth, hubspot, zoom, etc.) can be configured via a .env file.
 */

export function getSecret(secretName: string): string | object | null {
  return process.env[secretName] ?? null;
}

export function listSecretNames(): string[] {
  return Object.keys(process.env).filter(
    (k) => !k.startsWith('npm_') && !k.startsWith('NODE_') && !k.startsWith('PATH'),
  );
}
