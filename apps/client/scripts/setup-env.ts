import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  PRODUCTION_API_HTTP_HOSTNAMES,
  assertTigerPolicyForResolvedApiOrigin,
  productionApiUrlTigerExceptionEnabled,
} from '@gamezilla/domain/config/api-servers';
import { COMMIT_HASH_HEX_REGEX } from '@gamezilla/domain/config/app-metadata';
import { assert } from '@gamezilla/lib/assert';
import {
  createDopplerSecretStoreForScripts,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(clientRoot, '.env.local');
const tmpPath = `${outPath}.${process.pid}.tmp`;

// `setup-env.ts` runs under the `setup` turbo task (dependency of `dev` / `preview`).
// Production builds do not invoke this script — they read `EXPO_PUBLIC_*` at bundle time.

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

function trimStringOrNull(v: string | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readApiOriginFromProcessEnv(): string | null {
  return (
    trimStringOrNull(process.env.EXPO_PUBLIC_API_URL) ??
    trimStringOrNull(process.env.API_URL)
  );
}

function readLocalPreviewApiOriginFromProcessEnv(): string | null {
  return trimStringOrNull(process.env.LOCAL_PREVIEW_API_ORIGIN);
}

function createDopplerStore(): DopplerSecretStore {
  return createDopplerSecretStoreForScripts();
}

async function resolveApiOriginFromDoppler(
  store: DopplerSecretStore
): Promise<string | null> {
  const expo = await store.getOptional('EXPO_PUBLIC_API_URL');
  if (typeof expo === 'string' && expo.trim().length > 0) {
    return expo.trim();
  }
  const api = await store.getOptional('API_URL');
  if (typeof api === 'string' && api.trim().length > 0) {
    return api.trim();
  }
  return null;
}

async function resolveLoopbackPreviewOrigin(
  store: DopplerSecretStore | null
): Promise<string> {
  const fromEnv = readLocalPreviewApiOriginFromProcessEnv();
  if (fromEnv !== null) return fromEnv;
  const s = store ?? createDopplerStore();
  const fromDoppler = await s.getOptional('LOCAL_PREVIEW_API_ORIGIN');
  const trimmed =
    typeof fromDoppler === 'string' && fromDoppler.trim().length > 0
      ? fromDoppler.trim()
      : null;
  if (trimmed !== null) return trimmed;
  process.stdout.write(
    '[setup-env] LOCAL_PREVIEW_API_ORIGIN missing in env and Doppler; ' +
      `using default ${DEFAULT_LOCAL_PREVIEW_API_ORIGIN} (wrangler dev in apps/api).\n`
  );
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

async function applyProductionHostnameGuard(
  store: DopplerSecretStore | null,
  trimmed: string,
  sourceLabel: string
): Promise<string> {
  if (
    isProductionHostname(trimmed) &&
    !productionApiUrlTigerExceptionEnabled()
  ) {
    const replacement = await resolveLoopbackPreviewOrigin(store);
    process.stdout.write(
      `[setup-env] ${sourceLabel}=${trimmed} resolves to a production hostname; ` +
        `using loopback preview origin (${replacement}). ` +
        'Set EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL=1 to opt in to production.\n'
    );
    return replacement;
  }
  return trimmed;
}

async function resolveExpoPublicApiUrl(): Promise<string> {
  const fromInjectedEnv = readApiOriginFromProcessEnv();
  if (fromInjectedEnv !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_API_URL / API_URL from process env (e.g. doppler run).\n'
    );
    return applyProductionHostnameGuard(
      null,
      fromInjectedEnv,
      'process env API URL'
    );
  }

  let store: DopplerSecretStore;
  try {
    store = createDopplerStore();
  } catch {
    process.stderr.write(
      '[setup-env] Doppler token missing. Set DOPPLER_TOKEN or run `doppler login` so EXPO_PUBLIC_API_URL / API_URL can be read from Doppler.\n'
    );
    process.exit(1);
  }

  const fromDoppler = await resolveApiOriginFromDoppler(store);
  if (fromDoppler !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_API_URL / API_URL from Doppler API.\n'
    );
    return applyProductionHostnameGuard(store, fromDoppler, 'Doppler API URL');
  }

  process.stderr.write(
    '[setup-env] Set EXPO_PUBLIC_API_URL or API_URL in Doppler (local config).\n'
  );
  process.exit(1);
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

async function main(): Promise<void> {
  const raw = await resolveExpoPublicApiUrl();
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
}

await main();
