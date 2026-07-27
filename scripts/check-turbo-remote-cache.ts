/**
 * Verifies the Vercel Remote Cache configuration loaded from the secret store
 * (`dev`; CI: secrets-auth OIDC → env injection via `secrets-run` — not GitHub
 * `TURBO_*` secrets).
 *
 * The cache origin is baked into the turbo CLI, so only two values matter:
 *
 * - `TURBO_TOKEN`: Vercel scoped access token
 * - `TURBO_TEAM`: Vercel team slug that owns the cache
 * - `TURBO_CACHE` (optional): e.g. `remote:rw`
 *
 * Fast precheck: `GET /v8/artifacts/status` with the bearer token must return
 * 200 and a non-`disabled` status. Auth failures (401 / 403) and a disabled
 * cache are hard failures. A Vercel outage (5xx / unreachable) only warns —
 * Turbo falls back to the local + GitHub Actions cache layers.
 *
 * In CI, also runs a tiny `turbo run` probe and fails if Turbo prints
 * "Remote caching unavailable" (auth / team mismatch). `turbo --dry-run`
 * always reports `cache.remote: false` and must not be used here.
 */
import { spawnSync } from 'node:child_process';

const REMOTE_UNAVAILABLE = 'Remote caching unavailable';

const REQUIRED = ['TURBO_TOKEN', 'TURBO_TEAM'] as const;

const ARTIFACTS_STATUS_URL = 'https://vercel.com/api/v8/artifacts/status';

const TOKENS_URL = 'https://vercel.com/account/settings/tokens';

/** Same shape as `TurboCache.validate` in libs/infra. */
const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;

/** Cache is unusable through no fault of ours — warn and let Turbo degrade. */
class CacheOutageError extends Error {}

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
    'CI loads TURBO_* from secrets env `dev` via the secrets-auth action.'
  );
  console.error('');
  console.error('Secrets env `dev` must define (Vercel Remote Cache):');
  console.error(`  • TURBO_TOKEN — Vercel scoped access token (${TOKENS_URL})`);
  console.error('  • TURBO_TEAM  — Vercel team slug that owns the cache');
  console.error('');
  console.error(
    'Run `infra provision` (or set manually) so `prd` turbo secrets'
  );
  console.error(
    'match `dev`. Without remote cache, `check:ci` takes ~10+ min.'
  );
  console.error('See AGENTS.md § CI / Turbo cache.');
  console.error('');
  process.exit(1);
}

function warnDegraded(reason: string): void {
  console.warn(`Turbo remote cache unavailable: ${reason}`);
  console.warn(
    'Continuing with local + GitHub Actions cache only — `check:ci` will be slower.'
  );
}

/** Turbo passes `teamId` for `team_…` ids and `slug` for team slugs. */
function buildStatusUrl(team: string): string {
  const key = team.startsWith('team_') ? 'teamId' : 'slug';
  return `${ARTIFACTS_STATUS_URL}?${key}=${encodeURIComponent(team)}`;
}

function readStatus(json: unknown): string | undefined {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return undefined;
  }
  const value = (json as { status?: unknown }).status;
  return typeof value === 'string' ? value : undefined;
}

/** Hit the authed status endpoint to fail fast on a bad token / team. */
async function checkCacheReachable(
  token: string,
  team: string
): Promise<string> {
  const statusUrl = buildStatusUrl(team);
  let res: Response;
  try {
    res = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new CacheOutageError(
      `unreachable at ${statusUrl}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Vercel rejected TURBO_TOKEN for team "${team}" — HTTP ${String(res.status)} from ${statusUrl}. ` +
        `Mint a token at ${TOKENS_URL} whose scope covers TURBO_TEAM, then re-provision.`
    );
  }
  if (res.status >= 500) {
    throw new CacheOutageError(
      `HTTP ${String(res.status)} from ${statusUrl} (Vercel-side)`
    );
  }
  if (res.status !== 200) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(
      `cache status HTTP ${String(res.status)} from ${statusUrl}: ${body}`
    );
  }
  const json: unknown = await res.json().catch(() => null);
  const status = readStatus(json);
  if (status === undefined) {
    throw new Error(
      `cache status unexpected payload from ${statusUrl}: ${JSON.stringify(json)}`
    );
  }
  if (status === 'disabled') {
    throw new Error(
      `Remote Cache is disabled for team "${team}". Enable it in the Vercel team settings.`
    );
  }
  return status;
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
      '--cache-workers=1',
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
        'Fix TURBO_TOKEN / TURBO_TEAM in secrets env `dev` (mirrored from `prd`).'
    );
  }

  if (result.status !== 0) {
    fail(
      `turbo probe exited ${String(result.status)}.\n${log.trim().slice(0, 600) || '(no output)'}`
    );
  }

  console.log('Turbo remote cache reachable (probe run; no auth warning)');
}

function assertConfigured(): void {
  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (inCi()) {
      fail(
        'TURBO_TOKEN / TURBO_TEAM not in env after secrets injection. ' +
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

  if (isSet(process.env.TURBO_API)) {
    fail(
      `TURBO_API is set ("${process.env.TURBO_API}") but this repo uses the Vercel Remote Cache, ` +
        'which the turbo CLI reaches by default. Remove TURBO_API from the secret store and your shell.'
    );
  }

  const turboCache = (process.env.TURBO_CACHE ?? '').trim();
  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }
}

async function main(): Promise<void> {
  assertConfigured();

  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();
  const secretsEnv = (process.env.SECRETS_ENV ?? '').trim() || '(unset)';

  console.log(
    `Turbo env (SECRETS_ENV=${secretsEnv}): TURBO_TEAM=${turboTeam}, TURBO_TOKEN=<${String(turboToken.length)} chars>`
  );

  let status: string;
  try {
    status = await checkCacheReachable(turboToken, turboTeam);
  } catch (e) {
    if (e instanceof CacheOutageError) {
      warnDegraded(e.message);
      return;
    }
    fail(
      `cache status check failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (inCi()) {
    assertTurboRemoteCacheReachable();
  }

  console.log(
    `Turbo remote cache OK (Vercel, team ${turboTeam}, status ${status}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
