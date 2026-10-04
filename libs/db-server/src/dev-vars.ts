// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Wrangler worker secrets written by `apps/server/scripts/setup-dev-vars.ts`. */
export const DEV_VARS_PATH = join(REPO_ROOT, 'apps/server/.dev.vars');

/** Decode a value written by {@link encodeDevVarValue}. */
export function decodeDevVarValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }
  return trimmed
    .slice(1, -1)
    .replaceAll('\\n', '\n')
    .replaceAll('\\"', '"')
    .replaceAll('\\\\', '\\');
}

export function encodeDevVarValue(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`;
}

/** Reads a key from `.dev.vars` when present (local dev / preview). */
export function readDevVar(name: string): string | null {
  let content: string;
  try {
    content = readFileSync(DEV_VARS_PATH, 'utf8');
  } catch {
    return null;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (key !== name) continue;
    const value = decodeDevVarValue(trimmed.slice(eq + 1));
    return value.length > 0 ? value : null;
  }
  return null;
}

/** Reads `DATABASE_URL` from `.dev.vars` when present (local dev / preview). */
export function readDevVarsDatabaseUrl(): string | null {
  return readDevVar('DATABASE_URL');
}
