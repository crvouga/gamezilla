import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRODUCTION_API_HTTP_HOSTNAMES,
  assertTigerPolicyForResolvedApiOrigin,
  productionApiUrlTigerExceptionEnabled,
} from '@gamezilla/domain/config/api-servers';
import { COMMIT_HASH_HEX_REGEX } from '@gamezilla/domain/config/app-metadata';
import { assert } from '@gamezilla/lib/assert';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(clientRoot, '.env.local');
const tmpPath = `${outPath}.${process.pid}.tmp`;

// `setup-env.ts` is wired only into the `setup` turbo task, which is a
// dependency of `dev` and `preview` (see turbo.json). Both of those run a
// local Worker on this loopback origin (see `apps/api/package.json` scripts:
// `dev` and `preview` both use `--port 8788`). Production builds (`build`)
// do not invoke this script -- they read EXPO_PUBLIC_API_URL straight from
// the env at bundle time.
const LOCAL_API_DEV_ORIGIN = 'http://127.0.0.1:8788';

function isProductionHostname(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return (PRODUCTION_API_HTTP_HOSTNAMES as readonly string[]).includes(
      hostname
    );
  } catch {
    return false;
  }
}

function resolveExpoPublicApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    const trimmed = explicit.trim();
    if (
      isProductionHostname(trimmed) &&
      !productionApiUrlTigerExceptionEnabled()
    ) {
      process.stdout.write(
        `[setup-env] EXPO_PUBLIC_API_URL=${trimmed} resolves to a production hostname; ignoring for local setup and using ${LOCAL_API_DEV_ORIGIN}. Set EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1 to opt in.\n`
      );
      return LOCAL_API_DEV_ORIGIN;
    }
    return trimmed;
  }

  const apiUrl = process.env.API_URL;
  if (typeof apiUrl === 'string' && apiUrl.trim().length > 0) {
    const trimmed = apiUrl.trim();
    if (
      isProductionHostname(trimmed) &&
      !productionApiUrlTigerExceptionEnabled()
    ) {
      process.stdout.write(
        `[setup-env] API_URL=${trimmed} resolves to a production hostname; ignoring for local setup and using ${LOCAL_API_DEV_ORIGIN}. Set EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1 to opt in.\n`
      );
      return LOCAL_API_DEV_ORIGIN;
    }
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_API_URL unset; using API_URL from env.\n'
    );
    return trimmed;
  }

  process.stdout.write(
    `[setup-env] EXPO_PUBLIC_API_URL and API_URL unset; defaulting to local Worker ${LOCAL_API_DEV_ORIGIN}.\n`
  );
  return LOCAL_API_DEV_ORIGIN;
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

assertTigerPolicyForResolvedApiOrigin(origin, 'forbid-prod-on-this-machine');

const commitHash = resolveExpoPublicCommitHash();

const body =
  `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n` +
  `EXPO_PUBLIC_COMMIT_HASH=${JSON.stringify(commitHash)}\n`;
writeFileSync(tmpPath, body, { encoding: 'utf8' });
renameSync(tmpPath, outPath);

process.stdout.write(
  `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin} EXPO_PUBLIC_COMMIT_HASH=${commitHash.slice(0, 7)}…\n`
);
