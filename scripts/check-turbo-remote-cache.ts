/**
 * Verifies Vercel Remote Cache configuration loaded from secrets env `dev`
 * (CI: `SECRETS_TOKEN` → `secrets-run` — not GitHub `TURBO_*` secrets).
 *
 * Vercel Remote Cache uses two env vars (Turbo defaults to
 * `https://vercel.com` when `TURBO_API` is unset):
 *
 * - `TURBO_TOKEN`: Vercel scoped access token
 * - `TURBO_TEAM`: Vercel team slug
 * - `TURBO_CACHE` (optional): e.g. `remote:rw`
 *
 * `TURBO_API` must NOT be set — it overrides the Vercel default and routes
 * Turbo to a self-hosted cache origin instead.
 *
 * Fast precheck: `GET https://vercel.com/v8/artifacts/status` with the bearer
 * token must return 200 `{ status: 'ok' }` (401 → bad/expired token).
 *
 * In CI, also runs a tiny `turbo run` probe and fails if Turbo prints
 * "Remote caching unavailable" (auth / team mismatch). `turbo --dry-run`
 * always reports `cache.remote: false` and must not be used here.
 */
import {
  REMOTE_WRITE_DENIED,
  VERCEL_CACHE_API,
  checkVercelCacheStatus,
  isShortLivedTurboOAuthToken,
  probeTurboRemoteCacheWrite,
} from './lib/vercel-turbo-remote-cache';
import { assertVercelTurboToken } from './lib/vercel-turbo-token';

const REQUIRED = ['TURBO_TOKEN', 'TURBO_TEAM'] as const;

/** Same shape as `TurboCache.validate` in libs/infra. */
const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;

function isSet(v: string | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function inCi(): boolean {
  return (
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.CI === 'true' ||
    process.env.TURBO_FORCE_REMOTE_CACHE_CHECK === '1'
  );
}

function fail(message: string): never {
  console.error('');
  console.error('════════════════════════════════════════════════════════');
  console.error('  Turbo remote cache check FAILED');
  console.error('════════════════════════════════════════════════════════');
  console.error(message);
  console.error('');
  console.error('CI loads TURBO_* from secrets env `dev` via `secrets-run`.');
  console.error('The only GitHub secret involved is SECRETS_TOKEN.');
  console.error('');
  console.error('secrets env `dev` must define (Vercel Remote Cache):');
  console.error(
    '  • TURBO_TOKEN — never-expiring Vercel team token (Remote Cache write)'
  );
  console.error('  • TURBO_TEAM  — Vercel team slug');
  console.error('');
  console.error(
    'Do not set TURBO_API — it overrides Vercel and routes to self-hosted cache.'
  );
  console.error('');
  console.error(
    'Update TURBO_TOKEN in Infisical (secrets env `dev`, mirrored to `prd`).'
  );
  console.error('Without remote cache, `check:ci` takes ~10+ min.');
  console.error('See AGENTS.md § CI / Turbo Remote Cache.');
  console.error('');
  process.exit(1);
}

function assertTurboRemoteCacheReachable(): void {
  const probeFailure = probeTurboRemoteCacheWrite();
  if (probeFailure === null) {
    console.log('Turbo remote cache reachable (probe run; no auth warning)');
    return;
  }

  if (probeFailure.message.includes(REMOTE_WRITE_DENIED)) {
    fail(
      `${REMOTE_WRITE_DENIED}\n` +
        'Set a Vercel token with remote-cache write access in Infisical TURBO_TOKEN.'
    );
  }

  fail(
    `${probeFailure.message}\n` +
      'Fix TURBO_TOKEN / TURBO_TEAM in Infisical (secrets env `dev`, mirrored from `prd`).'
  );
}

async function main(): Promise<void> {
  const strict = inCi();

  if (isSet(process.env.TURBO_API)) {
    fail(
      'TURBO_API is set — delete it from Infisical. It overrides Vercel Remote Cache.'
    );
  }

  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      fail(
        'TURBO_TOKEN / TURBO_TEAM not in env after `secrets-run`. ' +
          'Set them in secrets env `dev` (see libs/infra/src/cli/secrets/turbo-token.ts).'
      );
    }
    console.log(
      'Turbo remote cache: no TURBO_* env set — skip (local dev without secrets).'
    );
    process.exit(0);
  }

  if (present.length !== REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !isSet(process.env[k]));
    fail(`incomplete secrets env. Missing: ${missing.join(', ')}`);
  }

  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();
  const secretsEnv = (process.env.SECRETS_ENV ?? '').trim() || '(unset)';

  const tokenErr = assertVercelTurboToken(turboToken);
  if (tokenErr !== null) {
    fail(`${tokenErr}\nUpdate TURBO_TOKEN in Infisical.`);
  }

  if (isShortLivedTurboOAuthToken(turboToken)) {
    fail(
      'TURBO_TOKEN is a short-lived turbo login OAuth token (vca_…).\n' +
        'Set a never-expiring Vercel token in Infisical TURBO_TOKEN.'
    );
  }

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }

  console.log(
    `Turbo env (secrets ${secretsEnv}): TURBO_TEAM=${turboTeam}, TURBO_TOKEN=<${String(turboToken.length)} chars>`
  );

  try {
    await checkVercelCacheStatus(turboToken, VERCEL_CACHE_API);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`cache status check failed: ${msg}`);
  }

  assertTurboRemoteCacheReachable();

  console.log(
    `Turbo remote cache OK (Vercel, team ${turboTeam}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
