/**
 * Trust boundary: `process.env` (e.g. from `doppler run --`) → `apps/api/.dev.vars`
 * for `wrangler dev`. When `DATABASE_URL` is unset, defaults to the local
 * {@link apps/db} PGlite HTTP API (same default port as `SQL_PORT` in server.ts).
 */

import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Must stay aligned with `apps/db` default listen host/port. */
const DEFAULT_LOCAL_DATABASE_URL = 'http://127.0.0.1:15432';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(apiRoot, '.dev.vars');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function encodeDevVarValue(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`;
}

function resolveDatabaseUrl(): string {
  const v = process.env['DATABASE_URL'];
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  process.stdout.write(
    `[setup-dev-vars] DATABASE_URL unset; using local dev default ${DEFAULT_LOCAL_DATABASE_URL}\n`
  );
  return DEFAULT_LOCAL_DATABASE_URL;
}

const databaseUrl = resolveDatabaseUrl();
const lines: string[] = [`DATABASE_URL=${encodeDevVarValue(databaseUrl)}`];

const google = process.env['GOOGLE_CLIENT_ID'];
if (typeof google === 'string' && google.length > 0) {
  lines.push(`GOOGLE_CLIENT_ID=${encodeDevVarValue(google)}`);
}

const body = `${lines.join('\n')}\n`;
writeFileSync(tmpPath, body, { encoding: 'utf8' });
renameSync(tmpPath, outPath);

process.stdout.write(
  `[setup-dev-vars] wrote .dev.vars with keys: ${lines
    .map((l) => l.split('=')[0])
    .join(', ')}\n`
);
