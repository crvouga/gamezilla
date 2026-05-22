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
 */
const VERCEL_USER_URL = 'https://api.vercel.com/v2/user';

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

async function main(): Promise<void> {
  const strict = inCi();

  if (isSet(process.env.TURBO_API)) {
    console.error(
      'Turbo remote cache: TURBO_API is set, but Vercel Remote Cache does not use it. ' +
        'Delete it from Doppler (`prod` and `local`) — `infra deploy` clears it ' +
        'automatically on every CI build via TurboCacheWorkerResource.destroy.'
    );
    process.exit(1);
  }

  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      console.error(
        'Turbo remote cache: required in CI but no TURBO_* env is set. ' +
          'Configure Doppler `local` with TURBO_TOKEN + TURBO_TEAM ' +
          '(see libs/infra/src/cli/secrets/turbo-token.ts for hints).'
      );
      process.exit(1);
    }
    console.log(
      'Turbo remote cache: no TURBO_* env set — skip (local dev without Doppler secrets).'
    );
    process.exit(0);
  }

  if (present.length !== REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !isSet(process.env[k]));
    console.error(
      `Turbo remote cache: incomplete env (partial config). Missing: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = (process.env.TURBO_CACHE ?? '').trim();

  if (turboCache !== '' && !TURBO_CACHE_RE.test(turboCache)) {
    console.error(
      `Turbo remote cache: invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`
    );
    process.exit(1);
  }

  try {
    await checkToken(turboToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Turbo remote cache: token check failed: ${msg}`);
    process.exit(1);
  }

  console.log(
    `Turbo remote cache OK (Vercel team ${turboTeam}${
      turboCache !== '' ? `, TURBO_CACHE=${turboCache}` : ''
    })`
  );
}

await main();
