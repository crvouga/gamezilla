/**
 * Trust boundary: `process.env` (e.g. from `doppler run --`) → `apps/client/.env.local`
 * for Expo. When `EXPO_PUBLIC_API_URL` is unset, defaults to local `wrangler dev`
 * for `@gamezilla/api` (`--port 8788`).
 * When `EXPO_PUBLIC_COMMIT_HASH` is unset, resolves from `git rev-parse HEAD` in this
 * work tree; if that fails, setup fails loudly (Tiger Style).
 */

import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMIT_HASH_HEX_REGEX } from '@gamezilla/domain/config/app-metadata';

/** Must stay aligned with `apps/api` `wrangler dev --port`. */
const DEFAULT_LOCAL_API_URL = 'http://localhost:8788';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(clientRoot, '.env.local');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function resolveExpoPublicApiUrl(): string {
  const v = process.env.EXPO_PUBLIC_API_URL;
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  process.stdout.write(
    `[setup-env] EXPO_PUBLIC_API_URL unset; using local dev default ${DEFAULT_LOCAL_API_URL}\n`
  );
  return DEFAULT_LOCAL_API_URL;
}

function resolveExpoPublicCommitHash(): string {
  const v = process.env.EXPO_PUBLIC_COMMIT_HASH;
  if (typeof v === 'string' && v.trim().length > 0) {
    const normalized = v.trim().toLowerCase();
    if (!COMMIT_HASH_HEX_REGEX.test(normalized)) {
      throw new Error(
        `EXPO_PUBLIC_COMMIT_HASH must match ${COMMIT_HASH_HEX_REGEX} (got: ${JSON.stringify(v)})`
      );
    }
    return normalized;
  }

  try {
    const stdout = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: clientRoot,
      encoding: 'utf8',
    });
    const normalized = stdout.trim().toLowerCase();
    if (!COMMIT_HASH_HEX_REGEX.test(normalized)) {
      throw new Error(
        `git rev-parse HEAD returned invalid SHA: ${JSON.stringify(stdout.trim())}`
      );
    }
    process.stdout.write(
      `[setup-env] EXPO_PUBLIC_COMMIT_HASH unset; using git HEAD ${normalized.slice(0, 7)}…\n`
    );
    return normalized;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `EXPO_PUBLIC_COMMIT_HASH is required and git rev-parse HEAD failed: ${detail}`
    );
  }
}

const raw = resolveExpoPublicApiUrl();
let origin: string;
try {
  origin = new URL(raw).origin;
} catch {
  throw new Error(
    `EXPO_PUBLIC_API_URL must be a valid URL (got: ${JSON.stringify(raw)})`
  );
}

const commitHash = resolveExpoPublicCommitHash();

const body =
  `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n` +
  `EXPO_PUBLIC_COMMIT_HASH=${JSON.stringify(commitHash)}\n`;
writeFileSync(tmpPath, body, { encoding: 'utf8' });
renameSync(tmpPath, outPath);

process.stdout.write(
  `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin} EXPO_PUBLIC_COMMIT_HASH=${commitHash.slice(0, 7)}…\n`
);
