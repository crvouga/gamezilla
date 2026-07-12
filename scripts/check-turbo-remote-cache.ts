/**
 * Verifies the self-hosted Turborepo Remote Cache configuration loaded from
 * the secret store (`dev`; CI: secrets-auth OIDC → env injection via
 * `secrets-run` — not GitHub `TURBO_*` secrets).
 *
 * Cache origin: https://turborepo.chrisvouga.dev (Turborepo `/v8/artifacts/*`
 * API backed by object storage). Consumer monorepos point Turbo at it with:
 *
 * - `TURBO_API`: cache origin (e.g. `https://turborepo.chrisvouga.dev`)
 * - `TURBO_TOKEN`: bearer token the cache validates
 * - `TURBO_TEAM`: any team slug (we use `crvouga`)
 * - `TURBO_CACHE` (optional): e.g. `remote:rw`
 *
 * Fast precheck: `GET ${TURBO_API}/v8/artifacts/status` with the bearer token
 * must return 200 `{ status: 'enabled' }` (401 → bad/expired token).
 *
 * In CI, also runs a tiny `turbo run` probe and fails if Turbo prints
 * "Remote caching unavailable" (auth / team mismatch). `turbo --dry-run`
 * always reports `cache.remote: false` and must not be used here.
 */
import { spawnSync } from 'node:child_process';

const REMOTE_UNAVAILABLE = 'Remote caching unavailable';

const REQUIRED = ['TURBO_API', 'TURBO_TOKEN', 'TURBO_TEAM'] as const;

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
    'CI loads TURBO_* from secrets env `dev` via the secrets-auth action.'
  );
  console.error('');
  console.error('Secrets env `dev` must define (self-hosted turborepo cache):');
  console.error(
    '  • TURBO_API   — cache origin (https://turborepo.chrisvouga.dev)'
  );
  console.error('  • TURBO_TOKEN — bearer token the cache validates');
  console.error('  • TURBO_TEAM  — any team slug (we use `crvouga`)');
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

/** Hit the cache's authed status endpoint to fail fast on a bad URL / token. */
async function checkCacheReachable(api: string, token: string): Promise<void> {
  const statusUrl = `${api.replace(/\/+$/, '')}/v8/artifacts/status`;
  let res: Response;
  try {
    res = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new Error(
      `cache unreachable at ${statusUrl}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `cache rejected TURBO_TOKEN — HTTP ${res.status} from ${statusUrl} (rotate in the secret store and re-mirror)`
    );
  }
  if (res.status !== 200) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(
      `cache status HTTP ${String(res.status)} from ${statusUrl}: ${body}`
    );
  }
  const json: unknown = await res.json().catch(() => null);
  const status =
    json !== null &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    'status' in json
      ? (json as { status: unknown }).status
      : undefined;
  if (status !== 'enabled') {
    throw new Error(
      `cache status unexpected payload from ${statusUrl}: ${JSON.stringify(json)}`
    );
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
        'Fix TURBO_API / TURBO_TOKEN / TURBO_TEAM in secrets env `dev` (mirrored from `prd`).'
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

  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      fail(
        'TURBO_API / TURBO_TOKEN / TURBO_TEAM not in env after secrets injection. ' +
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

  const turboApi = process.env.TURBO_API!.trim();
  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();
  const secretsEnv = (process.env.SECRETS_ENV ?? '').trim() || '(unset)';

  let parsedApi: URL;
  try {
    parsedApi = new URL(turboApi);
  } catch {
    fail(
      `invalid TURBO_API "${turboApi}" (expected e.g. https://turborepo.chrisvouga.dev)`
    );
  }
  if (parsedApi.protocol !== 'https:') {
    fail(`TURBO_API must be an https URL, got "${turboApi}"`);
  }
  if (
    parsedApi.hostname === 'vercel.com' ||
    parsedApi.hostname.endsWith('.vercel.com')
  ) {
    fail(
      `TURBO_API must not point at Vercel (got "${turboApi}") — use the self-hosted cache`
    );
  }

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }

  console.log(
    `Turbo env (SECRETS_ENV=${secretsEnv}): TURBO_API=${turboApi}, TURBO_TEAM=${turboTeam}, TURBO_TOKEN=<${String(turboToken.length)} chars>`
  );

  try {
    await checkCacheReachable(turboApi, turboToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`cache status check failed: ${msg}`);
  }

  if (strict) {
    assertTurboRemoteCacheReachable();
  }

  console.log(
    `Turbo remote cache OK (self-hosted ${turboApi}, team ${turboTeam}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
