import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertTigerPolicyForResolvedApiOrigin,
  DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  PRODUCTION_API_HTTP_HOSTNAMES,
  productionApiUrlTigerExceptionEnabled,
} from '@apps/client/config/api-servers';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/shared/local-api-origin';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createScriptSecretStore, type SecretStore } from '@pkgs/secret-store';

import { resolveExpoUseWatchmanForSetup } from './metro-watchman-env';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = join(clientRoot, '../..');
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
  return trimStringOrNull(process.env['EXPO_PUBLIC_API_URL']);
}

function readLocalPreviewApiOriginFromProcessEnv(): string | null {
  return trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
}

function createSecretsStore(): SecretStore {
  return createScriptSecretStore();
}

async function resolveApiOriginFromSecrets(
  store: SecretStore
): Promise<string | null> {
  const expo = (
    await store.getOptional('EXPO_PUBLIC_API_URL')
  )?.readSecretValue();
  if (typeof expo === 'string' && expo.trim().length > 0) {
    return expo.trim();
  }
  return null;
}

async function resolveLoopbackPreviewOrigin(
  store: SecretStore | null
): Promise<string> {
  const fromEnv = readLocalPreviewApiOriginFromProcessEnv();
  if (fromEnv !== null) return fromEnv;
  const s = store ?? createSecretsStore();
  const fromSecrets = (
    await s.getOptional('LOCAL_PREVIEW_API_ORIGIN')
  )?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  if (trimmed !== null) return trimmed;
  process.stdout.write(
    '[setup-env] LOCAL_PREVIEW_API_ORIGIN missing in env and secrets; ' +
      `using default ${DEFAULT_LOCAL_PREVIEW_API_ORIGIN} (wrangler dev in apps/api).\n`
  );
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

async function applyProductionHostnameGuard(
  store: SecretStore | null,
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
      '[setup-env] EXPO_PUBLIC_API_URL from process env (e.g. secrets-run).\n'
    );
    return applyProductionHostnameGuard(
      null,
      fromInjectedEnv,
      'process env EXPO_PUBLIC_API_URL'
    );
  }

  let store: SecretStore | null = null;
  try {
    store = createSecretsStore();
  } catch {
    process.stdout.write(
      '[setup-env] secrets not injected; using local preview API origin.\n'
    );
    return resolveLoopbackPreviewOrigin(null);
  }

  const fromSecrets = await resolveApiOriginFromSecrets(store);
  if (fromSecrets !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_API_URL from secret store API.\n'
    );
    return applyProductionHostnameGuard(
      store,
      fromSecrets,
      'secret store EXPO_PUBLIC_API_URL'
    );
  }

  process.stdout.write(
    '[setup-env] EXPO_PUBLIC_API_URL unset in env and secret store; using local preview API origin.\n'
  );
  return resolveLoopbackPreviewOrigin(store);
}

function resolveExpoPublicCommitHash(): string {
  const v = process.env['EXPO_PUBLIC_COMMIT_HASH'];
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

function resolveExpoPublicCommitDate(): string {
  const v = process.env['EXPO_PUBLIC_COMMIT_DATE'];
  if (typeof v === 'string' && v.trim().length > 0) {
    const normalized = v.trim();
    assertCommitDateIso(normalized);
    return normalized;
  }

  let stdout = '';
  assert.notThrows(() => {
    stdout = execFileSync('git', ['log', '-1', '--format=%cI', 'HEAD'], {
      cwd: clientRoot,
      encoding: 'utf8',
    });
  }, 'EXPO_PUBLIC_COMMIT_DATE is required and git log -1 --format=%cI HEAD failed');
  const normalized = stdout.trim();
  assertCommitDateIso(normalized);
  process.stdout.write(
    `[setup-env] EXPO_PUBLIC_COMMIT_DATE unset; using git HEAD committer date ${normalized}\n`
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

  origin = normalizeLoopbackOriginToLocalhost(origin);

  assertTigerPolicyForResolvedApiOrigin(origin, 'forbid-prod-on-this-machine');

  // Expo prefers process.env over `.env.local`. secrets-run may inject a
  // production EXPO_PUBLIC_API_URL; keep the resolved loopback in-process so
  // `expo export` cannot bake api.gamezilla.app after we rewrote `.env.local`.
  process.env['EXPO_PUBLIC_API_URL'] = origin;

  const commitHash = resolveExpoPublicCommitHash();
  const commitDate = resolveExpoPublicCommitDate();
  const e2eFlag = trimStringOrNull(process.env['EXPO_PUBLIC_E2E']);
  const expoUseWatchman = resolveExpoUseWatchmanForSetup({
    clientRoot,
    monorepoRoot,
  });

  // Runtime knobs (EMQX / Sentry / observability backend) come from synced
  // `client_config`, not Expo env — do not write them here.
  let body =
    `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n` +
    `EXPO_PUBLIC_COMMIT_HASH=${JSON.stringify(commitHash)}\n` +
    `EXPO_PUBLIC_COMMIT_DATE=${JSON.stringify(commitDate)}\n` +
    `EXPO_USE_WATCHMAN=${JSON.stringify(expoUseWatchman)}\n`;
  if (e2eFlag !== null) {
    body += `EXPO_PUBLIC_E2E=${JSON.stringify(e2eFlag)}\n`;
  }
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin} EXPO_PUBLIC_COMMIT_HASH=${commitHash.slice(0, 7)}… EXPO_PUBLIC_COMMIT_DATE=${commitDate} EXPO_USE_WATCHMAN=${expoUseWatchman}\n`
  );
}

await main();
