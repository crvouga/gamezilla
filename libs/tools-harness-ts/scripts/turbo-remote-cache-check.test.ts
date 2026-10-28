import { describe, expect, test } from 'bun:test';

import { TURBO_API, TURBO_TEAM } from '@libs/secrets-shared-ts/turbo-token';
import {
  configChecks,
  type Http,
  PROBE_TASK,
  roundTripCheck,
  statusCheck,
  turboProbeCheck,
} from './turbo-remote-cache-check';

const REMOTE_CACHE = { apiUrl: TURBO_API, teamSlug: TURBO_TEAM };

function failed(env: NodeJS.ProcessEnv): string[] {
  return configChecks(env, REMOTE_CACHE)
    .filter((check) => !check.ok)
    .map((check) => check.name);
}

describe('configChecks', () => {
  test('a token and no overrides pass', () => {
    expect(
      failed({ TURBO_TOKEN: 'tok', TURBO_CACHE: 'local:rw,remote:rw' })
    ).toEqual([]);
  });

  test('a missing or blank token fails', () => {
    expect(failed({})).toEqual(['TURBO_TOKEN']);
    expect(failed({ TURBO_TOKEN: '  ' })).toEqual(['TURBO_TOKEN']);
  });

  test('an env TURBO_TEAM other than the teamSlug fails', () => {
    // regression: turbo-team-secret-overrides-team-slug
    expect(failed({ TURBO_TOKEN: 'tok', TURBO_TEAM: 'local' })).toEqual([
      'TURBO_TEAM env',
    ]);
  });

  test('an env TURBO_TEAM equal to the teamSlug passes', () => {
    expect(failed({ TURBO_TOKEN: 'tok', TURBO_TEAM })).toEqual([]);
  });

  test('an env TURBO_API other than the apiUrl fails', () => {
    expect(
      failed({ TURBO_TOKEN: 'tok', TURBO_API: 'https://cache.example' })
    ).toEqual(['TURBO_API env']);
  });

  test('a TURBO_CACHE without remote fails', () => {
    expect(failed({ TURBO_TOKEN: 'tok', TURBO_CACHE: 'local:rw' })).toEqual([
      'TURBO_CACHE',
    ]);
  });

  test('turbo.json drifting from the pinned constants fails', () => {
    const names = configChecks({ TURBO_TOKEN: 'tok' }, { teamSlug: 'other' })
      .filter((check) => !check.ok)
      .map((check) => check.name);
    expect(names).toEqual([
      'turbo.json remoteCache.teamSlug',
      'turbo.json remoteCache.apiUrl',
    ]);
  });
});

function fakeHttp(
  responses: Record<string, { status: number; body?: string }>
): {
  http: Http;
  calls: string[];
} {
  const calls: string[] = [];
  const stored = new Map<string, string>();
  const http: Http = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    const fixed = responses[init.method];
    if (fixed !== undefined)
      return { status: fixed.status, body: fixed.body ?? '' };
    if (init.method === 'PUT') {
      stored.set(url, init.body ?? '');
      return { status: 202, body: '' };
    }
    const body = stored.get(url);
    return body === undefined
      ? { status: 404, body: '' }
      : { status: 200, body };
  };
  return { http, calls };
}

describe('statusCheck', () => {
  test('enabled passes', async () => {
    const { http, calls } = fakeHttp({
      GET: { status: 200, body: '{"status":"enabled"}' },
    });
    expect((await statusCheck(http, TURBO_API, TURBO_TEAM)).ok).toBe(true);
    expect(calls).toEqual([
      `GET ${TURBO_API}/v8/artifacts/status?slug=${TURBO_TEAM}`,
    ]);
  });

  test('disabled or rejected fails', async () => {
    const disabled = fakeHttp({
      GET: { status: 200, body: '{"status":"disabled"}' },
    });
    expect((await statusCheck(disabled.http, TURBO_API, TURBO_TEAM)).ok).toBe(
      false
    );
    const rejected = fakeHttp({ GET: { status: 403 } });
    const check = await statusCheck(rejected.http, TURBO_API, TURBO_TEAM);
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('HTTP 403');
  });
});

describe('roundTripCheck', () => {
  test('an artifact that comes back passes', async () => {
    const { http, calls } = fakeHttp({});
    expect(
      (await roundTripCheck(http, TURBO_API, TURBO_TEAM, 'abc123')).ok
    ).toBe(true);
    expect(calls.map((call) => call.split(' ')[0])).toEqual(['PUT', 'GET']);
  });

  test('a rejected upload fails without reading', async () => {
    const { http, calls } = fakeHttp({ PUT: { status: 403 } });
    const check = await roundTripCheck(http, TURBO_API, TURBO_TEAM, 'abc123');
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('PUT HTTP 403');
    expect(calls).toHaveLength(1);
  });

  test('an upload that does not come back fails', async () => {
    const { http } = fakeHttp({ GET: { status: 404 } });
    expect(
      (await roundTripCheck(http, TURBO_API, TURBO_TEAM, 'abc123')).ok
    ).toBe(false);
  });
});

function dryRun(status: string, source?: string): string {
  return JSON.stringify({
    tasks: [{ taskId: PROBE_TASK, cache: { status, source } }],
  });
}

describe('turboProbeCheck', () => {
  test('turbo disabling the remote cache fails', () => {
    // regression: turbo-team-secret-overrides-team-slug
    const check = turboProbeCheck({
      exitCode: 0,
      stdout: dryRun('MISS'),
      stderr:
        ' WARNING  Remote cache returned 403 and access could not be restored; disabling remote caching for this run\n',
    });
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('403');
  });

  test('a remote hit passes', () => {
    const check = turboProbeCheck({
      exitCode: 0,
      stdout: dryRun('HIT', 'REMOTE'),
      stderr: '',
    });
    expect(check).toMatchObject({
      ok: true,
      detail: `${PROBE_TASK} is a hit (REMOTE)`,
    });
  });

  test('a clean miss passes', () => {
    expect(
      turboProbeCheck({ exitCode: 0, stdout: dryRun('MISS'), stderr: '' }).ok
    ).toBe(true);
  });

  test('a failed turbo or a missing probe task fails', () => {
    expect(
      turboProbeCheck({ exitCode: 1, stdout: '', stderr: 'boom\n' }).ok
    ).toBe(false);
    expect(
      turboProbeCheck({
        exitCode: 0,
        stdout: JSON.stringify({ tasks: [] }),
        stderr: '',
      }).ok
    ).toBe(false);
  });
});
