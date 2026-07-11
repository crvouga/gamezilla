import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLACEHOLDER_RE = /^<[^>]+>$/;
const MIN_TOKEN_LENGTH = 20;

export function assertVercelTurboToken(token: string): string | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return 'TURBO_TOKEN must not be empty';
  }
  if (PLACEHOLDER_RE.test(trimmed)) {
    return `TURBO_TOKEN looks like a placeholder (${trimmed}) — use a real Vercel token`;
  }
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return `TURBO_TOKEN is too short (${String(trimmed.length)} chars) — expected a Vercel access token`;
  }
  return null;
}

type LocalTurboAuth = {
  readonly token: string;
};

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** macOS: `~/Library/Application Support/turborepo/auth.json` */
export function resolveLocalTurboAuthPath(): string | null {
  const candidates = [
    join(homedir(), 'Library', 'Application Support', 'turborepo', 'auth.json'),
    join(homedir(), '.config', 'turborepo', 'auth.json'),
    join(homedir(), '.local', 'share', 'turborepo', 'auth.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

export function readLocalTurboAuthToken(): string {
  const path = resolveLocalTurboAuthPath();
  if (path === null) {
    throw new Error(
      'No local turbo auth found — run `bunx turbo login` or pass --token'
    );
  }

  const parsed = readJsonFile(path);
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('token' in parsed) ||
    typeof (parsed as { token?: unknown }).token !== 'string'
  ) {
    throw new Error(`Unexpected turbo auth JSON at ${path}`);
  }

  const token = (parsed as LocalTurboAuth).token.trim();
  const err = assertVercelTurboToken(token);
  if (err !== null) {
    throw new Error(`${err} (from ${path})`);
  }
  return token;
}
