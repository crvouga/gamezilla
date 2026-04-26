import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMIT_HASH_HEX_REGEX } from '@gamezilla/domain/config/app-metadata';
import { assert } from '@gamezilla/lib/assert';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(clientRoot, '.env.local');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function resolveExpoPublicApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim();
  }

  const apiUrl = process.env.API_URL;
  if (typeof apiUrl === 'string' && apiUrl.trim().length > 0) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_API_URL unset; using API_URL from env.\n'
    );
    return apiUrl.trim();
  }

  assert.fail(
    'EXPO_PUBLIC_API_URL or API_URL is required (set API_URL for env-only API origin)'
  );
}

function resolveExpoPublicCommitHash(): string {
  const v = process.env.EXPO_PUBLIC_COMMIT_HASH;
  if (typeof v === 'string' && v.trim().length > 0) {
    const normalized = v.trim().toLowerCase();
    assert.ok(
      COMMIT_HASH_HEX_REGEX.test(normalized),
      `EXPO_PUBLIC_COMMIT_HASH must match ${COMMIT_HASH_HEX_REGEX}`,
      { value: v, normalized }
    );
    return normalized;
  }

  let stdout = '';
  assert.notThrows(() => {
    stdout = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: clientRoot,
      encoding: 'utf8',
    });
  }, 'EXPO_PUBLIC_COMMIT_HASH is required and git rev-parse HEAD failed');
  const normalized = stdout.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(normalized),
    'git rev-parse HEAD returned invalid SHA',
    { value: stdout.trim(), normalized }
  );
  process.stdout.write(
    `[setup-env] EXPO_PUBLIC_COMMIT_HASH unset; using git HEAD ${normalized.slice(0, 7)}…\n`
  );
  return normalized;
}

const raw = resolveExpoPublicApiUrl();
let origin = '';
assert.notThrows(
  () => {
    origin = new URL(raw).origin;
  },
  'EXPO_PUBLIC_API_URL must be a valid URL',
  { value: raw }
);

const commitHash = resolveExpoPublicCommitHash();

const body =
  `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n` +
  `EXPO_PUBLIC_COMMIT_HASH=${JSON.stringify(commitHash)}\n`;
writeFileSync(tmpPath, body, { encoding: 'utf8' });
renameSync(tmpPath, outPath);

process.stdout.write(
  `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin} EXPO_PUBLIC_COMMIT_HASH=${commitHash.slice(0, 7)}…\n`
);
