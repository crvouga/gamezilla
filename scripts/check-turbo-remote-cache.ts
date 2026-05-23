/**
 * Verifies Vercel Remote Cache configuration. Expected Doppler `local` /
 * CI secrets (managed by `libs/infra/src/cli/resources/doppler.ts` and
 * `libs/infra/src/cli/secrets/turbo-token.ts`):
 *
 * - `TURBO_TOKEN`: a Vercel Access Token from
 *   https://vercel.com/account/tokens scoped to the team in `TURBO_TEAM`.
 * - `TURBO_TEAM`: Vercel team slug (the URL slug, e.g. `acme-co`).
 * - `TURBO_CACHE` (optional): the `--cache` flag value, e.g. `remote:rw`.
 *
 * The torn-down self-hosted Cloudflare cache used to populate `TURBO_API`;
 * we now reject it explicitly so a stale value can't silently route
 * cache traffic at a Worker that no longer exists.
 *
 * In CI, also runs `turbo run --dry-run=json` and fails if Turbo reports
 * `cache.remote: false` — env vars alone are not enough; without a linked
 * remote, `check:ci` would rerun every package cold (~10+ min).
 */
import { spawnSync } from 'node:child_process';

const VERCEL_USER_URL = 'https://api.vercel.com/v2/user';

const REQUIRED = ['TURBO_TOKEN', 'TURBO_TEAM'] as const;

/** Same shape as `TurboCache.validate` in libs/infra. */
const TURBO_CACHE_RE = /^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/;

type DryRunCache = {
  readonly remote?: boolean;
  readonly status?: string;
  readonly source?: string;
};

type DryRunTask = {
  readonly taskId?: string;
  readonly cache?: DryRunCache;
};

type DryRunJson = {
  readonly tasks?: readonly DryRunTask[];
};

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
  console.error('CI expects Doppler `local` to define:');
  console.error('  • TURBO_TOKEN — Vercel access token (team-scoped)');
  console.error('  • TURBO_TEAM  — Vercel team slug');
  console.error('');
  console.error('Without remote cache, `bun run check:ci` reruns every task');
  console.error('from scratch (~10+ min) and logs look like hung empty lines.');
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
      `Vercel rejected TURBO_TOKEN — HTTP ${res.status} from ${VERCEL_USER_URL} (rotate the token in Doppler and re-mirror)`
    );
  }
  if (!res.ok) {
    // Transient 5xx / rate limits shouldn't fail CI on a token Vercel
    // has accepted before; let the actual cache request surface it.
    return;
  }
}

function assertTurboRemoteCacheLinked(): void {
  const result = spawnSync(
    'bunx',
    ['turbo', 'run', 'tc', '--filter=@pkgs/assert', '--dry-run=json'],
    {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (result.status !== 0) {
    fail(
      `turbo dry-run exited ${String(result.status)}.\n` +
        `stderr: ${stderr.trim() || '(empty)'}\n` +
        `stdout: ${stdout.trim().slice(0, 400) || '(empty)'}`
    );
  }

  let parsed: DryRunJson;
  try {
    parsed = JSON.parse(stdout) as DryRunJson;
  } catch {
    fail(
      `turbo dry-run did not return JSON (first 400 chars):\n${stdout.slice(0, 400)}`
    );
  }

  const tasks = parsed.tasks ?? [];
  if (tasks.length === 0) {
    fail('turbo dry-run scheduled zero tasks for @pkgs/assert#tc');
  }

  const remoteOff = tasks.filter((t) => t.cache?.remote !== true);
  if (remoteOff.length > 0) {
    const detail = remoteOff
      .map((t) => {
        const id = t.taskId ?? '(unknown task)';
        const remote = String(t.cache?.remote ?? false);
        return `  • ${id} (cache.remote=${remote})`;
      })
      .join('\n');
    fail(
      'Turbo is not using Vercel Remote Cache for these tasks:\n' +
        `${detail}\n` +
        'Confirm TURBO_TOKEN is a valid team token and TURBO_TEAM matches the slug in the Vercel URL.'
    );
  }

  const sample = tasks[0]?.cache;
  console.log(
    `Turbo remote cache linked (dry-run: remote enabled, sample status=${sample?.status ?? '?'} source=${sample?.source ?? '?'})`
  );
}

async function main(): Promise<void> {
  const strict = inCi();

  if (isSet(process.env.TURBO_API)) {
    fail(
      'TURBO_API is set, but Vercel Remote Cache does not use it. ' +
        'Delete it from Doppler (`prod` and `local`).'
    );
  }

  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      fail(
        'required in CI but no TURBO_TOKEN / TURBO_TEAM env is set. ' +
          'Configure Doppler `local` (see libs/infra/src/cli/secrets/turbo-token.ts).'
      );
    }
    console.log(
      'Turbo remote cache: no TURBO_* env set — skip (local dev without Doppler secrets).'
    );
    process.exit(0);
  }

  if (present.length !== REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !isSet(process.env[k]));
    fail(`incomplete env. Missing: ${missing.join(', ')}`);
  }

  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    fail(`invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`);
  }

  try {
    await checkToken(turboToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`token check failed: ${msg}`);
  }

  if (strict) {
    assertTurboRemoteCacheLinked();
  }

  console.log(
    `Turbo remote cache OK (Vercel team ${turboTeam}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
