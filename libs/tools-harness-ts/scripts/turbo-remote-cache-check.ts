// @io-wall-ok — command entry: probes the Vercel Remote Cache over the network and runs turbo.
/**
 * `bun run check:turborepo-remote-caching`: is the Vercel Remote Cache
 * configured and working for this checkout, under the secrets every run gets?
 *
 * 1. **Config.** What a bare `turbo run` resolves: `TURBO_TOKEN` present,
 *    `TURBO_API` / `TURBO_TEAM` not overriding `remoteCache` in `turbo.json`,
 *    `TURBO_CACHE` not dropping `remote`. An env `TURBO_TEAM` wins over the
 *    `teamSlug` for every turbo outside turbo-ci-run (Infisical once held
 *    `TURBO_TEAM=local`: every job's setup got 403). A laptop's ignored
 *    `.turbo/config.json` `teamId` hides it, so this fails on the mismatch
 *    itself, not on a request that happens to work here.
 * 2. **Token.** `GET /v8/artifacts/status` answers `enabled` for the team.
 * 3. **Round trip.** A throwaway artifact goes up and comes back byte for
 *    byte: write access, not just read.
 * 4. **Turbo itself.** `turbo run <probe> --dry=json --cache=remote:r` from
 *    an empty local cache, with the env untouched, must not warn that the
 *    remote cache returned an error and was disabled.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TURBO_API, TURBO_TEAM } from '@libs/secrets-shared-ts/turbo-token';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { artifactUrl, retryRateLimited } from './turbo-preflight';

export type Check = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type RemoteCacheConfig = {
  readonly apiUrl?: string;
  readonly teamSlug?: string;
};

/** The cheap cacheable task the turbo probe asks about. */
export const PROBE_TASK = '//#task:tokens:generate';

const PROBE_BODY = 'turbo remote cache check';

/** Pure: the configuration a bare `turbo run` would use, checked. */
export function configChecks(
  env: NodeJS.ProcessEnv,
  remoteCache: RemoteCacheConfig
): Check[] {
  const checks: Check[] = [];
  const token = env['TURBO_TOKEN']?.trim() ?? '';
  checks.push({
    name: 'TURBO_TOKEN',
    ok: token !== '',
    detail:
      token !== ''
        ? 'present'
        : 'missing: run `bun run secrets:pull`, or `bun run secrets:turbo-token` to mint one',
  });
  checks.push(
    pinned('turbo.json remoteCache.teamSlug', remoteCache.teamSlug, TURBO_TEAM),
    pinned('turbo.json remoteCache.apiUrl', remoteCache.apiUrl, TURBO_API)
  );
  checks.push(
    notOverridden(env, 'TURBO_TEAM', remoteCache.teamSlug ?? TURBO_TEAM),
    notOverridden(env, 'TURBO_API', remoteCache.apiUrl ?? TURBO_API)
  );
  const cache = env['TURBO_CACHE']?.trim() ?? '';
  checks.push({
    name: 'TURBO_CACHE',
    ok: cache === '' || /\bremote:/.test(cache),
    detail:
      cache === ''
        ? 'unset (turbo default: local and remote)'
        : /\bremote:/.test(cache)
          ? cache
          : `${cache} leaves the remote cache out`,
  });
  return checks;
}

function pinned(
  name: string,
  actual: string | undefined,
  expected: string
): Check {
  return {
    name,
    ok: actual === expected,
    detail:
      actual === expected
        ? expected
        : `${actual ?? 'unset'}, but @libs/secrets-shared-ts/turbo-token pins ${expected}`,
  };
}

function notOverridden(
  env: NodeJS.ProcessEnv,
  key: 'TURBO_TEAM' | 'TURBO_API',
  configured: string
): Check {
  const value = env[key]?.trim() ?? '';
  return {
    name: `${key} env`,
    ok: value === '' || value === configured,
    detail:
      value === ''
        ? 'unset (turbo.json applies)'
        : value === configured
          ? value
          : `${value} overrides turbo.json's ${configured} for every bare \`turbo run\`; ` +
            'delete it from Infisical (a local .turbo/config.json teamId can hide this)',
  };
}

export type HttpResponse = { readonly status: number; readonly body: string };
export type Http = (
  url: string,
  init: { readonly method: string; readonly body?: string }
) => Promise<HttpResponse>;

/** Token check: the team's remote cache answers `enabled`. */
export async function statusCheck(
  http: Http,
  api: string,
  team: string
): Promise<Check> {
  const url = `${api.replace(/\/+$/, '')}/v8/artifacts/status?slug=${encodeURIComponent(team)}`;
  const res = await http(url, { method: 'GET' });
  const status = parseStatus(res.body);
  return {
    name: 'token accepted',
    ok: res.status === 200 && status === 'enabled',
    detail:
      res.status === 200
        ? `remote cache ${status ?? 'status unknown'} for ${team}`
        : `HTTP ${String(res.status)} for ${team}: the token is not scoped to the team, revoked or expired ` +
          '(`bun run secrets:turbo-token` rotates it)',
  };
}

function parseStatus(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { status?: unknown };
    return typeof parsed.status === 'string' ? parsed.status : null;
  } catch {
    return null;
  }
}

/** Write access: a throwaway artifact goes up and comes back unchanged. */
export async function roundTripCheck(
  http: Http,
  api: string,
  team: string,
  hash: string
): Promise<Check> {
  const url = artifactUrl(api, team, hash);
  const put = await http(url, { method: 'PUT', body: PROBE_BODY });
  if (put.status < 200 || put.status >= 300) {
    return {
      name: 'write and read back',
      ok: false,
      detail: `PUT HTTP ${String(put.status)}: the token can read but not write`,
    };
  }
  const get = await http(url, { method: 'GET' });
  const ok = get.status === 200 && get.body === PROBE_BODY;
  return {
    name: 'write and read back',
    ok,
    detail: ok
      ? `artifact ${hash} stored and fetched`
      : `GET HTTP ${String(get.status)}: the uploaded artifact did not come back`,
  };
}

/** Pure: read `turbo run --dry=json --cache=remote:r` for the probe task. */
export function turboProbeCheck(result: {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}): Check {
  const name = 'turbo reads the remote cache';
  const warning = result.stderr
    .split('\n')
    .find(
      (line) => /remote cach/i.test(line) && /warn|error|disabl/i.test(line)
    );
  if (warning !== undefined) return { name, ok: false, detail: warning.trim() };
  if (result.exitCode !== 0) {
    return {
      name,
      ok: false,
      detail: `turbo exited ${String(result.exitCode)}: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
    };
  }
  const task = (
    JSON.parse(result.stdout) as {
      tasks?: {
        taskId?: string;
        cache?: { status?: string; source?: string };
      }[];
    }
  ).tasks?.find((t) => t.taskId === PROBE_TASK);
  if (task === undefined) {
    return {
      name,
      ok: false,
      detail: `${PROBE_TASK} missing from the dry run`,
    };
  }
  return {
    name,
    ok: true,
    detail:
      task.cache?.status === 'HIT'
        ? `${PROBE_TASK} is a hit (${task.cache.source ?? 'unknown source'})`
        : `${PROBE_TASK} is a miss (not built with these inputs yet); no remote error`,
  };
}

export function formatChecks(checks: readonly Check[]): string {
  return checks
    .map((check) => `${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`)
    .join('\n');
}

const REQUEST_TIMEOUT_MS = 15_000;

function wallHttp(token: string): Http {
  return async (url, init) => {
    const res = await retryRateLimited(() =>
      fetch(url, {
        method: init.method,
        headers: { Authorization: `Bearer ${token}` },
        ...(init.body === undefined
          ? {}
          : {
              body: new Blob([init.body], { type: 'application/octet-stream' }),
            }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    );
    return { status: res.status, body: await res.text() };
  };
}

function randomHash(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function runTurboProbe(repoRoot: string): Check {
  const cacheDir = mkdtempSync(join(tmpdir(), 'turbo-remote-cache-check-'));
  try {
    const result = spawnSync(
      'turbo',
      ['run', PROBE_TASK, '--dry=json', '--cache=remote:r'],
      {
        cwd: repoRoot,
        env: { ...process.env, TURBO_CACHE_DIR: cacheDir },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    return turboProbeCheck({
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: `${result.stderr ?? ''}${result.error === undefined ? '' : String(result.error)}`,
    });
  } finally {
    removeTree(cacheDir, { whenLocked: 'leave' });
  }
}

async function main(): Promise<number> {
  const repoRoot = join(import.meta.dirname, '../../..');
  const turboJson = JSON.parse(
    readFileSync(join(repoRoot, 'turbo.json'), 'utf8')
  ) as {
    remoteCache?: RemoteCacheConfig;
  };
  const remoteCache = turboJson.remoteCache ?? {};
  const checks = configChecks(process.env, remoteCache);
  const token = process.env['TURBO_TOKEN']?.trim() ?? '';
  if (token !== '') {
    const http = wallHttp(token);
    const api = remoteCache.apiUrl ?? TURBO_API;
    const team = remoteCache.teamSlug ?? TURBO_TEAM;
    const probe = async (
      run: () => Promise<Check>,
      name: string
    ): Promise<Check> =>
      run().catch((error: unknown) => ({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      }));
    checks.push(
      await probe(() => statusCheck(http, api, team), 'token accepted')
    );
    checks.push(
      await probe(
        () => roundTripCheck(http, api, team, randomHash()),
        'write and read back'
      )
    );
    checks.push(runTurboProbe(repoRoot));
  }
  console.log(formatChecks(checks));
  const failed = checks.filter((check) => !check.ok).length;
  console.log(
    failed === 0
      ? '\nTurborepo remote caching is healthy.'
      : `\n${String(failed)} check(s) failed.`
  );
  return failed === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(await main());
