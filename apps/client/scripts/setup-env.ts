import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  PRODUCTION_API_HTTP_HOSTNAMES,
  assertTigerPolicyForResolvedApiOrigin,
  productionApiUrlTigerExceptionEnabled,
} from '@apps/client/config/api-servers';
import { COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso } from '@pkgs/git';
import { createScriptSecretStore, type SecretStore } from '@pkgs/secret-store';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/shared/local-api-origin';

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

async function resolveExpoPublicSentryDsn(
  store: SecretStore | null
): Promise<string | null> {
  const fromEnv = trimStringOrNull(process.env['EXPO_PUBLIC_SENTRY_DSN']);
  if (fromEnv !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_SENTRY_DSN from process env (e.g. secrets-run).\n'
    );
    return fromEnv;
  }
  if (store === null) return null;
  const fromSecrets = (
    await store.getOptional('EXPO_PUBLIC_SENTRY_DSN')
  )?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  if (trimmed !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_SENTRY_DSN from secret store.\n'
    );
    return trimmed;
  }
  return null;
}

async function resolveExpoPublicAuthPublishableKey(
  store: SecretStore | null
): Promise<string | null> {
  const fromExpoEnv = trimStringOrNull(
    process.env['EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY']
  );
  if (fromExpoEnv !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY from process env (e.g. secrets-run).\n'
    );
    return fromExpoEnv;
  }

  const fromAuthEnv = trimStringOrNull(process.env['AUTH_PUBLISHABLE_KEY']);
  if (fromAuthEnv !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY from AUTH_PUBLISHABLE_KEY in process env.\n'
    );
    return fromAuthEnv;
  }

  if (store === null) return null;

  const fromSecrets = (
    await store.getOptional('AUTH_PUBLISHABLE_KEY')
  )?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  if (trimmed !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY from secret store AUTH_PUBLISHABLE_KEY.\n'
    );
    return trimmed;
  }
  return null;
}

async function resolveExpoPublicObservabilityBackend(
  store: SecretStore | null
): Promise<string | null> {
  const fromEnv = trimStringOrNull(
    process.env['EXPO_PUBLIC_OBSERVABILITY_BACKEND']
  );
  if (fromEnv !== null) return fromEnv;
  if (store === null) return null;
  const fromSecrets = (
    await store.getOptional('EXPO_PUBLIC_OBSERVABILITY_BACKEND')
  )?.readSecretValue();
  return trimStringOrNull(
    typeof fromSecrets === 'string' ? fromSecrets : undefined
  );
}

async function resolveExpoPublicPowerSyncUrl(
  store: SecretStore | null
): Promise<string | null> {
  const fromEnv = trimStringOrNull(process.env['EXPO_PUBLIC_PS_URL']);
  if (fromEnv !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_PS_URL from process env (e.g. secrets-run).\n'
    );
    return fromEnv;
  }
  if (store === null) return null;
  const fromSecrets = (await store.getOptional('PS_URL'))?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  if (trimmed !== null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_PS_URL from secret store PS_URL.\n'
    );
    return trimmed;
  }
  return null;
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

  const commitHash = resolveExpoPublicCommitHash();
  const commitDate = resolveExpoPublicCommitDate();
  const e2eFlag = trimStringOrNull(process.env['EXPO_PUBLIC_E2E']);
  const expoUseWatchman = resolveExpoUseWatchmanForSetup({
    clientRoot,
    monorepoRoot,
  });

  let store: SecretStore | null = null;
  try {
    store = createSecretsStore();
  } catch {
    store = null;
  }

  const sentryDsn = await resolveExpoPublicSentryDsn(store);
  const authPublishableKey = await resolveExpoPublicAuthPublishableKey(store);
  const observabilityBackend =
    await resolveExpoPublicObservabilityBackend(store);
  const powersyncUrl = await resolveExpoPublicPowerSyncUrl(store);
  if (sentryDsn === null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_SENTRY_DSN unset; Sentry error reporting disabled in dev.\n'
    );
  }
  if (authPublishableKey === null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY unset; sign-in disabled until AUTH_PUBLISHABLE_KEY is provisioned.\n'
    );
  }
  if (powersyncUrl === null) {
    process.stdout.write(
      '[setup-env] EXPO_PUBLIC_PS_URL unset; PowerSync sync disabled until PS_URL is provisioned.\n'
    );
  }

  let body =
    `EXPO_PUBLIC_API_URL=${JSON.stringify(origin)}\n` +
    `EXPO_PUBLIC_COMMIT_HASH=${JSON.stringify(commitHash)}\n` +
    `EXPO_PUBLIC_COMMIT_DATE=${JSON.stringify(commitDate)}\n` +
    `EXPO_USE_WATCHMAN=${JSON.stringify(expoUseWatchman)}\n`;
  if (sentryDsn !== null) {
    body += `EXPO_PUBLIC_SENTRY_DSN=${JSON.stringify(sentryDsn)}\n`;
  }
  if (authPublishableKey !== null) {
    body += `EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY=${JSON.stringify(authPublishableKey)}\n`;
  }
  if (observabilityBackend !== null) {
    body += `EXPO_PUBLIC_OBSERVABILITY_BACKEND=${JSON.stringify(observabilityBackend)}\n`;
  }
  if (powersyncUrl !== null) {
    body += `EXPO_PUBLIC_PS_URL=${JSON.stringify(powersyncUrl)}\n`;
  }
  if (e2eFlag !== null) {
    body += `EXPO_PUBLIC_E2E=${JSON.stringify(e2eFlag)}\n`;
  }
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-env] wrote .env.local with EXPO_PUBLIC_API_URL=${origin} EXPO_PUBLIC_COMMIT_HASH=${commitHash.slice(0, 7)}… EXPO_PUBLIC_COMMIT_DATE=${commitDate}\n`
  );
}

await main();
