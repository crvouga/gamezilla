// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
import { execFileSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/public/local-api-origin';
import {
  assertTigerPolicyForResolvedApiOrigin,
  DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  PRODUCTION_API_HTTP_HOSTNAMES,
  productionApiUrlTigerExceptionEnabled,
} from '@libs/client-app/config/api-servers';
import { assert } from '@pkgs/assert';
import { assertCommitDateIso, COMMIT_HASH_HEX_REGEX } from '@pkgs/git';
import { createScriptSecretStore, type SecretStore } from '@pkgs/secret-store';

const productRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(productRoot, '.env.local');
const tmpPath = `${outPath}.${process.pid}.tmp`;

// `setup-env.ts` runs from the `setup` script (npm's `predev` lifecycle, and the
// `setup` turbo task that `preview` depends on).
// Production builds do not invoke this script — they read `VITE_*` at bundle time.

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
  return trimStringOrNull(process.env['VITE_API_URL']);
}

function readLocalPreviewApiOriginFromProcessEnv(): string | null {
  return trimStringOrNull(process.env['VITE_LOCAL_PREVIEW_API_ORIGIN']);
}

function createSecretsStore(): SecretStore {
  return createScriptSecretStore();
}

async function resolveApiOriginFromSecrets(
  store: SecretStore
): Promise<string | null> {
  const value = (await store.getOptional('VITE_API_URL'))?.readSecretValue();
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
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
    await s.getOptional('VITE_LOCAL_PREVIEW_API_ORIGIN')
  )?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  if (trimmed !== null) return trimmed;
  process.stdout.write(
    '[setup-env] VITE_LOCAL_PREVIEW_API_ORIGIN missing in env and secrets; ' +
      `using default ${DEFAULT_LOCAL_PREVIEW_API_ORIGIN} (wrangler dev in apps/server).\n`
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
        'Set VITE_ALLOW_PRODUCTION_API_URL=1 to opt in to production.\n'
    );
    return replacement;
  }
  return trimmed;
}

async function resolveViteApiUrl(): Promise<string> {
  const fromInjectedEnv = readApiOriginFromProcessEnv();
  if (fromInjectedEnv !== null) {
    return applyProductionHostnameGuard(
      null,
      fromInjectedEnv,
      'process env VITE_API_URL'
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
    return applyProductionHostnameGuard(
      store,
      fromSecrets,
      'secret store VITE_API_URL'
    );
  }

  process.stdout.write(
    '[setup-env] VITE_API_URL unset in env and secret store; using local preview API origin.\n'
  );
  return resolveLoopbackPreviewOrigin(store);
}

function resolveViteCommitHash(): string {
  const v = process.env['VITE_COMMIT_HASH'];
  if (typeof v === 'string' && v.trim().length > 0) {
    const normalized = v.trim().toLowerCase();
    assert.ok(
      COMMIT_HASH_HEX_REGEX.test(normalized),
      `VITE_COMMIT_HASH must match ${COMMIT_HASH_HEX_REGEX}`,
      { value: v, normalized }
    );
    return normalized;
  }

  let stdout = '';
  assert.notThrows(() => {
    stdout = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: productRoot,
      encoding: 'utf8',
    });
  }, 'VITE_COMMIT_HASH is required and git rev-parse HEAD failed');
  const normalized = stdout.trim().toLowerCase();
  assert.ok(
    COMMIT_HASH_HEX_REGEX.test(normalized),
    'git rev-parse HEAD returned invalid SHA',
    { value: stdout.trim(), normalized }
  );
  return normalized;
}

function resolveViteCommitDate(): string {
  const v = process.env['VITE_COMMIT_DATE'];
  if (typeof v === 'string' && v.trim().length > 0) {
    const normalized = v.trim();
    assertCommitDateIso(normalized);
    return normalized;
  }

  let stdout = '';
  assert.notThrows(() => {
    stdout = execFileSync('git', ['log', '-1', '--format=%cI', 'HEAD'], {
      cwd: productRoot,
      encoding: 'utf8',
    });
  }, 'VITE_COMMIT_DATE is required and git log -1 --format=%cI HEAD failed');
  const normalized = stdout.trim();
  assertCommitDateIso(normalized);
  return normalized;
}

async function main(): Promise<void> {
  const raw = await resolveViteApiUrl();
  let origin = '';
  assert.notThrows(
    () => {
      origin = new URL(raw).origin;
    },
    'VITE_API_URL must be a valid URL',
    { value: raw }
  );

  origin = normalizeLoopbackOriginToLocalhost(origin);

  assertTigerPolicyForResolvedApiOrigin(origin, 'forbid-prod-on-this-machine');

  // Vite reads `.env.local`; secrets-run may inject a production VITE_API_URL —
  // keep the resolved loopback in-process so `vite build` cannot bake
  // api.gamezilla.app after we rewrote `.env.local`.
  process.env['VITE_API_URL'] = origin;

  const commitHash = resolveViteCommitHash();
  const commitDate = resolveViteCommitDate();
  const e2eFlag = trimStringOrNull(process.env['VITE_E2E']);

  // Runtime knobs (EMQX / observability backend) come from synced
  // `client_config`, not build env — do not write them here.
  let body =
    `VITE_API_URL=${JSON.stringify(origin)}\n` +
    `VITE_COMMIT_HASH=${JSON.stringify(commitHash)}\n` +
    `VITE_COMMIT_DATE=${JSON.stringify(commitDate)}\n`;
  if (e2eFlag !== null) {
    body += `VITE_E2E=${JSON.stringify(e2eFlag)}\n`;
  }
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-env] .env.local: ${origin} @ ${commitHash.slice(0, 7)}\n`
  );
}

await main();
