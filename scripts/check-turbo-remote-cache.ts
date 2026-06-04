/**
 * Verifies Vercel Remote Cache configuration loaded from Doppler `dev`
 * (CI: `DOPPLER_SERVICE_TOKEN` → `doppler run` — not GitHub `TURBO_*` secrets).
 *
 * Expected Doppler `dev` keys (see `libs/infra/src/cli/resources/doppler.ts`):
 *
 * - `TURBO_TOKEN`: Vercel access token (https://vercel.com/account/tokens)
 * - `TURBO_TEAM`: Vercel team slug
 * - `TURBO_CACHE` (optional): e.g. `remote:rw`
 *
 * Rejects stale `TURBO_API` from the torn-down self-hosted cache.
 *
 * In CI, runs a tiny `turbo run` probe and fails if Turbo prints
 * "Remote caching unavailable" (auth / team mismatch). `turbo --dry-run`
 * always reports `cache.remote: false` and must not be used here.
 */
import { spawnSync } from 'node:child_process';

const VERCEL_USER_URL = 'https://api.vercel.com/v2/user';
const REMOTE_UNAVAILABLE = 'Remote caching unavailable';

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
  console.error(
    'CI loads TURBO_* from Doppler config `dev` via `doppler run`.'
  );
  console.error('The only GitHub secret involved is DOPPLER_SERVICE_TOKEN.');
  console.error('');
  console.error('Doppler `dev` must define:');
  console.error('  • TURBO_TOKEN — Vercel access token (team-scoped)');
  console.error('  • TURBO_TEAM  — Vercel team slug');
  console.error('');
  console.error(
    'Run `infra deploy` (or mirror manually) so `prd` turbo secrets'
  );
  console.error(
    'match `dev`. Without remote cache, `check:ci` takes ~10+ min.'
  );
  console.error('See AGENTS.md § CI / Turbo Remote Cache.');
  console.error('');
  process.exit(1);
}

async function checkToken(token: string): Promise<void> {
  const res = await fetch(VERCEL_USER_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Vercel rejected TURBO_TOKEN — HTTP ${res.status} from ${VERCEL_USER_URL} (rotate in Doppler and re-mirror to \`local\`)`
    );
  }
  if (!res.ok) {
    return;
  }
}

function assertTurboRemoteCacheReachable(): void {
  const result = spawnSync(
    'bunx',
    [
      'turbo',
      'run',
      'tc',
      '--filter=@pkgs/assert',
      '--cache=local:rw,remote:rw',
      '--output-logs=none',
    ],
    {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (log.includes(REMOTE_UNAVAILABLE)) {
    const line =
      log.split('\n').find((l) => l.includes(REMOTE_UNAVAILABLE)) ??
      REMOTE_UNAVAILABLE;
    fail(
      `${line.trim()}\n` +
        'Fix TURBO_TOKEN / TURBO_TEAM in Doppler (`dev`, mirrored from `prd`).'
    );
  }

  if (result.status !== 0) {
    fail(
      `turbo probe exited ${String(result.status)}.\n${log.trim().slice(0, 600) || '(no output)'}`
    );
  }

  console.log('Turbo remote cache reachable (probe run; no auth warning)');
}

async function main(): Promise<void> {
  const strict = inCi();

  if (isSet(process.env.TURBO_API)) {
    fail(
      'TURBO_API is set, but Vercel Remote Cache does not use it. ' +
        'Delete it from Doppler (`prd` and `dev`).'
    );
  }

  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      fail(
        'TURBO_TOKEN / TURBO_TEAM not in env after `doppler run`. ' +
          'Set them in Doppler config `dev` (see libs/infra/src/cli/secrets/turbo-token.ts).'
      );
    }
    console.log(
      'Turbo remote cache: no TURBO_* env set — skip (local dev without Doppler secrets).'
    );
    process.exit(0);
  }

  if (present.length !== REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !isSet(process.env[k]));
    fail(`incomplete Doppler env. Missing: ${missing.join(', ')}`);
  }

  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();
  const dopplerConfig = (process.env.DOPPLER_CONFIG ?? '').trim() || '(unset)';

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }

  console.log(
    `Turbo env (Doppler ${dopplerConfig}): TURBO_TEAM=${turboTeam}, TURBO_TOKEN=<${String(turboToken.length)} chars>`
  );

  try {
    await checkToken(turboToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`token check failed: ${msg}`);
  }

  if (strict) {
    assertTurboRemoteCacheReachable();
  }

  console.log(
    `Turbo remote cache OK (Vercel team ${turboTeam}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
