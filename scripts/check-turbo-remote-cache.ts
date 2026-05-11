/**
 * Verifies self-hosted Turbo remote cache configuration (see AGENTS.md,
 * deployment-pipeline.yml). Expected Doppler `local` / CI secrets:
 * `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`, `TURBO_CACHE` (e.g. `remote:rw`).
 *
 * Keep `EXPECTED_API_ORIGIN` aligned with `turboCachePublicUrl()` in
 * `packages/infra/src/project-config.ts` and `TurboCache.validate` in
 * `packages/infra/src/cli/secrets/turbo-token.ts`.
 */
const EXPECTED_API_ORIGIN = 'https://turbo-cache.gamezilla.app';

const REQUIRED = [
  'TURBO_API',
  'TURBO_TOKEN',
  'TURBO_TEAM',
  'TURBO_CACHE',
] as const;

/** Same rule as `TurboCache.validate` in packages/infra. */
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

async function checkToken(apiBase: string, token: string): Promise<void> {
  const base = apiBase.replace(/\/$/, '');
  const url = `${base}/v8/artifacts/status?teamId=default`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
}

async function main(): Promise<void> {
  const strict = inCi();
  const present = REQUIRED.filter((k) => isSet(process.env[k]));

  if (present.length === 0) {
    if (strict) {
      console.error(
        'Turbo remote cache: required in CI but no TURBO_* env is set. ' +
          'Configure Doppler `local` with TURBO_API, TURBO_TOKEN, TURBO_TEAM, TURBO_CACHE.'
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

  const turboApi = process.env.TURBO_API!.trim();
  const turboToken = process.env.TURBO_TOKEN!.trim();
  const turboTeam = process.env.TURBO_TEAM!.trim();
  const turboCache = process.env.TURBO_CACHE!.trim();

  let apiUrl: URL;
  try {
    apiUrl = new URL(turboApi);
  } catch {
    console.error(
      `Turbo remote cache: TURBO_API is not a valid URL (${turboApi})`
    );
    process.exit(1);
  }

  if (apiUrl.origin !== EXPECTED_API_ORIGIN) {
    console.error(
      `Turbo remote cache: TURBO_API origin must be ${EXPECTED_API_ORIGIN} (got ${apiUrl.origin})`
    );
    process.exit(1);
  }

  if (!TURBO_CACHE_RE.test(turboCache)) {
    console.error(
      `Turbo remote cache: invalid TURBO_CACHE "${turboCache}" (expected e.g. remote:rw)`
    );
    process.exit(1);
  }

  try {
    await checkToken(turboApi, turboToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Turbo remote cache: token / API check failed: ${msg}`);
    process.exit(1);
  }

  console.log(
    `Turbo remote cache OK (API ${apiUrl.origin}, team ${turboTeam}, TURBO_CACHE=${turboCache})`
  );
}

await main();
