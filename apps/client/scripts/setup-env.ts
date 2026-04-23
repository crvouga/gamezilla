/**
 * Trust boundary: `process.env` (e.g. from `doppler run --`) → `apps/client/.env.local`
 * for Expo. When `EXPO_PUBLIC_API_URL` is unset, defaults to local `wrangler dev`
 * for `@gamezilla/api` (`--port 8788`).
 */

import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const raw = resolveExpoPublicApiUrl();
let origin: string;
try {
  origin = new URL(raw).origin;
} catch {
  throw new Error(
    `EXPO_PUBLIC_API_URL must be a valid URL (got: ${JSON.stringify(raw)})`
  );
}

const body = `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n`;
writeFileSync(tmpPath, body, { encoding: 'utf8' });
renameSync(tmpPath, outPath);

process.stdout.write(
  `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin}\n`
);
