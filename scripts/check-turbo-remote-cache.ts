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
import { spawnSync } from 'node:child_process';
import { assertVercelTurboToken } from './lib/vercel-turbo-token';

const REMOTE_UNAVAILABLE = 'Remote caching unavailable';
const REMOTE_AUTH_FAILED = 'Authentication failed';
const REMOTE_WRITE_DENIED = 'Insufficient permissions to write to remote cache';
const VERCEL_CACHE_API = 'https://vercel.com';
const OK_STATUSES = new Set(['ok', 'enabled']);

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
    '  • TURBO_TOKEN — Vercel scoped access token (Settings → Tokens)'
  );
  console.error('  • TURBO_TEAM  — Vercel team slug (from team URL)');
  console.error('');
  console.error(
    'Do not set TURBO_API — it overrides Vercel and routes to self-hosted cache.'
  );
  console.error('');
  console.error(
    'Seed with `bun run secrets:seed-vercel-turbo-cache -- --token … --team …`.'
  );
  console.error('Without remote cache, `check:ci` takes ~10+ min.');
  console.error('See AGENTS.md § CI / Turbo Remote Cache.');
  console.error('');
  process.exit(1);
}

/** Hit Vercel's authed status endpoint to fail fast on a bad token. */
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
      `cache rejected TURBO_TOKEN — HTTP ${res.status} from ${statusUrl} (rotate in secret store and re-mirror)`
    );
  }
  if (res.ok) {
    try {
      const body = (await res.json()) as { status?: string };
      if (typeof body.status === 'string' && !OK_STATUSES.has(body.status)) {
        throw new Error(
          `unexpected status response from ${statusUrl}: ${JSON.stringify(body)}`
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('unexpected status')) {
        throw e;
      }
    }
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

  if (log.includes(REMOTE_UNAVAILABLE) || log.includes(REMOTE_AUTH_FAILED)) {
    const line =
      log
        .split('\n')
        .find(
          (l) =>
            l.includes(REMOTE_UNAVAILABLE) || l.includes(REMOTE_AUTH_FAILED)
        ) ?? REMOTE_UNAVAILABLE;
    fail(
      `${line.trim()}\n` +
        'Fix TURBO_TOKEN / TURBO_TEAM in secrets env `dev` (mirrored from `prd`).\n' +
        'Seed a real token: `bun run secrets:seed-vercel-turbo-cache -- --from-local-auth --team <slug>`'
    );
  }

  if (log.includes(REMOTE_WRITE_DENIED)) {
    fail(
      `${REMOTE_WRITE_DENIED}\n` +
        'Use a Vercel scoped access token with Remote Cache write access (Settings → Tokens).'
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
      'TURBO_API is set — delete it from Infisical. It overrides Vercel Remote Cache.\n' +
        'Run `bun run secrets:seed-vercel-turbo-cache` to remove stale TURBO_API.'
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
    fail(
      `${tokenErr}\n` +
        'Seed a real token: `bun run secrets:seed-vercel-turbo-cache -- --from-local-auth --team <slug>`'
    );
  }

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }

  console.log(
    `Turbo env (secrets ${secretsEnv}): TURBO_TEAM=${turboTeam}, TURBO_TOKEN=<${String(turboToken.length)} chars>`
  );

  try {
    await checkCacheReachable(VERCEL_CACHE_API, turboToken);
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
