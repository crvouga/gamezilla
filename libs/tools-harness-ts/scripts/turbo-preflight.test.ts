import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { PrefetchIo } from './turbo-preflight';
import {
  artifactUrl,
  localCacheFlag,
  planFromDryRun,
  prefetchArtifacts,
  readsRemoteCache,
  resolveRemoteHits,
  restoreEveryHit,
  retryRateLimited,
} from './turbo-preflight';

function dryRun(tasks: readonly unknown[]): string {
  return JSON.stringify({ id: 'run', tasks });
}

describe('planFromDryRun', () => {
  // regression: turbo-preflight-uncacheable-hit
  test('never reuses a local or remote artifact for a non-cacheable task', async () => {
    const plan = planFromDryRun(
      dryRun([
        {
          taskId: '@libs/tools-harness-ts#ci:audit',
          hash: 'old-pass',
          command: 'bun audit',
          resolvedTaskDefinition: { cache: false },
          cache: { status: 'HIT', source: 'LOCAL' },
        },
      ])
    );
    const lookedUp: string[] = [];
    const remote = await resolveRemoteHits(
      plan,
      async (hash) => {
        lookedUp.push(hash);
        return true;
      },
      2
    );
    expect(remote.toExecute.map((task) => task.taskId)).toEqual([
      '@libs/tools-harness-ts#ci:audit',
    ]);
    expect(lookedUp).toEqual([]);
    expect(remote.tasks[0]?.hit).toBe(false);
  });
  test('prefetches only remote hits the misses depend on', () => {
    const plan = planFromDryRun(
      dryRun([
        {
          taskId: '@pkgs/a#tc',
          hash: 'aaa',
          command: 'tsc',
          dependencies: ['@pkgs/b#tc', '@pkgs/z#tc'],
          cache: { status: 'HIT', source: 'REMOTE' },
        },
        {
          taskId: '@pkgs/b#tc',
          hash: 'bbb',
          command: 'tsc',
          cache: { status: 'HIT', source: 'REMOTE' },
        },
        {
          taskId: '@pkgs/z#tc',
          hash: 'zzz',
          command: '<NONEXISTENT>',
          cache: { status: 'MISS' },
        },
        {
          taskId: '@pkgs/a#test',
          hash: 'ttt',
          command: 'bun test',
          dependencies: ['@pkgs/a#tc'],
          cache: { status: 'MISS' },
        },
        {
          taskId: '@pkgs/unrelated#tc',
          hash: 'uuu',
          command: 'tsc',
          cache: { status: 'HIT', source: 'REMOTE' },
        },
      ])
    );
    expect(plan.toExecute.map((task) => task.taskId)).toEqual(['@pkgs/a#test']);
    expect(plan.remoteHits.map((task) => task.hash).sort()).toEqual([
      'aaa',
      'bbb',
    ]);
  });

  test('splits real tasks into misses and hits', () => {
    const plan = planFromDryRun(
      dryRun([
        {
          taskId: '@pkgs/a#tc',
          hash: 'aaa',
          command: 'tsc',
          cache: { status: 'HIT', source: 'LOCAL' },
        },
        {
          taskId: '@pkgs/b#tc',
          hash: 'bbb',
          command: 'tsc',
          cache: { status: 'HIT', source: 'REMOTE' },
        },
        {
          taskId: '@pkgs/c#test',
          hash: 'ccc',
          command: 'bun test',
          dependencies: ['@pkgs/b#tc'],
          cache: { status: 'MISS' },
        },
      ])
    );
    expect(plan.tasks.map((task) => task.taskId)).toEqual([
      '@pkgs/a#tc',
      '@pkgs/b#tc',
      '@pkgs/c#test',
    ]);
    expect(plan.toExecute.map((task) => task.taskId)).toEqual(['@pkgs/c#test']);
    expect(plan.remoteHits.map((task) => task.hash)).toEqual(['bbb']);
  });

  test('drops <NONEXISTENT> placeholders, which report MISS but never run', () => {
    const plan = planFromDryRun(
      dryRun([
        {
          taskId: '@pkgs/a#build',
          hash: 'aaa',
          command: '<NONEXISTENT>',
          cache: { status: 'MISS' },
        },
      ])
    );
    expect(plan.tasks).toEqual([]);
    expect(plan.toExecute).toEqual([]);
  });

  test('rejects output that is not a dry run', () => {
    expect(() => planFromDryRun('{}')).toThrow('missing tasks array');
  });
});

describe('restoreEveryHit', () => {
  test('prefetches every remote hit, whether or not a miss needs it', () => {
    const plan = restoreEveryHit(
      planFromDryRun(
        dryRun([
          {
            taskId: '@libs/a#test:spec',
            hash: 'eee',
            command: 'bun run test-spec.ts',
            dependencies: ['@libs/a#tc'],
            cache: { status: 'HIT', source: 'REMOTE' },
          },
          {
            taskId: '@libs/a#tc',
            hash: 'aaa',
            command: 'tsc',
            cache: { status: 'HIT', source: 'LOCAL' },
          },
        ])
      )
    );
    expect(plan.toExecute).toEqual([]);
    expect(plan.remoteHits.map((task) => task.hash)).toEqual(['eee']);
  });
});

describe('artifactUrl', () => {
  test('addresses a team by slug unless it is a team id', () => {
    expect(artifactUrl('https://cache.example/', 'local', 'abc')).toBe(
      'https://cache.example/v8/artifacts/abc?slug=local'
    );
    expect(artifactUrl('https://cache.example', 'team_1', 'abc')).toBe(
      'https://cache.example/v8/artifacts/abc?teamId=team_1'
    );
  });
});

function memoryIo(remote: Record<string, string>): {
  readonly io: PrefetchIo;
  readonly files: Map<string, string>;
  readonly fetches: string[];
} {
  const files = new Map<string, string>();
  const fetches: string[] = [];
  const io: PrefetchIo = {
    fetchArtifact: async (hash) => {
      fetches.push(hash);
      if (hash === 'boom') throw new Error('network');
      const body = remote[hash];
      return body === undefined ? null : new TextEncoder().encode(body);
    },
    exists: (path) => files.has(path),
    writeFile: (path, data) => {
      files.set(
        path,
        typeof data === 'string' ? data : new TextDecoder().decode(data)
      );
    },
  };
  return { io, files, fetches };
}

// prefetchArtifacts builds native paths; the fake store keys must match.
const CACHE = join('/', 'cache');
function cached(name: string): string {
  return join(CACHE, name);
}

describe('prefetchArtifacts', () => {
  test('writes turbo local-cache layout: tar then meta', async () => {
    const { io, files } = memoryIo({ aaa: 'tar-bytes' });
    const result = await prefetchArtifacts(['aaa'], CACHE, io, 4);
    expect(result).toEqual({ fetched: 1, failed: 0 });
    expect([...files.keys()]).toEqual([
      cached('aaa.tar.zst'),
      cached('aaa-meta.json'),
    ]);
    expect(files.get(cached('aaa.tar.zst'))).toBe('tar-bytes');
    expect(JSON.parse(files.get(cached('aaa-meta.json')) ?? '')).toEqual({
      hash: 'aaa',
      duration: 0,
    });
  });

  test('skips hashes already cached locally', async () => {
    const { io, files, fetches } = memoryIo({ aaa: 'new' });
    files.set(cached('aaa.tar.zst'), 'old');
    files.set(
      cached('aaa-meta.json'),
      JSON.stringify({ hash: 'aaa', duration: 0 })
    );
    const result = await prefetchArtifacts(['aaa'], CACHE, io, 4);
    expect(result).toEqual({ fetched: 1, failed: 0 });
    expect(fetches).toEqual([]);
    expect(files.get(cached('aaa.tar.zst'))).toBe('old');
  });

  // regression: overlapping-cache-prefetch-downloads
  test('overlapping prerequisites download each artifact only once', async () => {
    const { io, fetches } = memoryIo({ aaa: 'a', bbb: 'b' });
    const result = await prefetchArtifacts(
      ['aaa', 'aaa', 'bbb', 'aaa'],
      CACHE,
      io,
      4
    );
    expect(fetches.sort()).toEqual(['aaa', 'bbb']);
    expect(result).toEqual({ fetched: 2, failed: 0 });
  });

  // regression: incomplete-cache-prefetch-never-repairs
  test('a metadata write failure is repaired on the next prefetch', async () => {
    const { io, files, fetches } = memoryIo({ aaa: 'complete' });
    const interrupted = {
      ...io,
      writeFile: (path: string, data: Uint8Array | string) => {
        if (path.endsWith('-meta.json')) throw new Error('interrupted write');
        io.writeFile(path, data);
      },
    };
    expect(await prefetchArtifacts(['aaa'], CACHE, interrupted, 4)).toEqual({
      fetched: 0,
      failed: 1,
    });
    expect(files.has(cached('aaa-meta.json'))).toBe(false);
    expect(await prefetchArtifacts(['aaa'], CACHE, io, 4)).toEqual({
      fetched: 1,
      failed: 0,
    });
    expect(fetches).toEqual(['aaa', 'aaa']);
    expect(JSON.parse(files.get(cached('aaa-meta.json'))!)).toEqual({
      hash: 'aaa',
      duration: 0,
    });
  });

  test('counts missing and failing artifacts without writing them', async () => {
    const { io, files } = memoryIo({ aaa: 'a', ccc: 'c' });
    const result = await prefetchArtifacts(
      ['aaa', 'gone', 'boom', 'ccc'],
      CACHE,
      io,
      2
    );
    expect(result).toEqual({ fetched: 2, failed: 2 });
    expect([...files.keys()].sort()).toEqual([
      cached('aaa-meta.json'),
      cached('aaa.tar.zst'),
      cached('ccc-meta.json'),
      cached('ccc.tar.zst'),
    ]);
  });
});

describe('cache flag parts', () => {
  test('the dry run asks only the local part of the cache flag', () => {
    expect(localCacheFlag('local:rw,remote:rw')).toBe('local:rw');
    expect(localCacheFlag('remote:r,local:r')).toBe('local:r');
    expect(localCacheFlag('remote:rw')).toBeNull();
    expect(localCacheFlag('local:,remote:rw')).toBeNull();
  });

  test('the remote is asked only when the flag reads it', () => {
    expect(readsRemoteCache('local:rw,remote:rw')).toBe(true);
    expect(readsRemoteCache('local:rw,remote:r')).toBe(true);
    expect(readsRemoteCache('local:rw,remote:w')).toBe(false);
    expect(readsRemoteCache('local:rw')).toBe(false);
  });
});

describe('resolveRemoteHits', () => {
  // `a#test` depends on `a#tc`; the local cache has neither, nor `b#tc`.
  const localPlan = planFromDryRun(
    dryRun([
      {
        taskId: '@pkgs/a#tc',
        hash: 'aaa',
        command: 'tsc',
        cache: { status: 'MISS' },
      },
      {
        taskId: '@pkgs/a#test',
        hash: 'ttt',
        command: 'bun test',
        dependencies: ['@pkgs/a#tc'],
        cache: { status: 'MISS' },
      },
      {
        taskId: '@pkgs/b#tc',
        hash: 'bbb',
        command: 'tsc',
        cache: { status: 'MISS' },
      },
      {
        taskId: '@pkgs/c#tc',
        hash: 'ccc',
        command: 'tsc',
        cache: { status: 'HIT', source: 'LOCAL' },
      },
    ])
  );

  test('a local miss the remote holds becomes a remote hit', async () => {
    const asked: string[] = [];
    const plan = await resolveRemoteHits(
      localPlan,
      (hash) => {
        asked.push(hash);
        return Promise.resolve(hash === 'aaa' || hash === 'bbb');
      },
      4
    );
    expect(asked.sort()).toEqual(['aaa', 'bbb', 'ttt']);
    expect(plan.toExecute.map((task) => task.taskId)).toEqual(['@pkgs/a#test']);
    expect(plan.remoteHits.map((task) => task.taskId)).toEqual(['@pkgs/a#tc']);
  });

  test('every miss found on the remote leaves nothing to execute', async () => {
    const plan = await resolveRemoteHits(
      localPlan,
      () => Promise.resolve(true),
      2
    );
    expect(plan.toExecute).toEqual([]);
    expect(plan.tasks.every((task) => task.hit)).toBe(true);
  });

  test('a failed lookup is a miss: the task runs', async () => {
    const plan = await resolveRemoteHits(
      localPlan,
      (hash) =>
        hash === 'bbb'
          ? Promise.reject(new Error('network'))
          : Promise.resolve(false),
      4
    );
    expect(plan.toExecute.map((task) => task.taskId).sort()).toEqual([
      '@pkgs/a#tc',
      '@pkgs/a#test',
      '@pkgs/b#tc',
    ]);
  });
});

describe('retryRateLimited', () => {
  // regression: vercel-remote-cache-rate-limited-misses
  test('a 429 is retried, after Retry-After, until the cache answers', async () => {
    const statuses = [429, 429, 200];
    const waits: number[] = [];
    const res = await retryRateLimited(
      async () =>
        new Response(null, {
          status: statuses.shift()!,
          headers: { 'retry-after': '2' },
        }),
      async (ms) => {
        waits.push(ms);
      }
    );
    expect(res.status).toBe(200);
    expect(waits).toEqual([2000, 2000]);
  });

  test('without Retry-After it backs off, and gives up after its attempts', async () => {
    const waits: number[] = [];
    let calls = 0;
    const res = await retryRateLimited(
      async () => {
        calls += 1;
        return new Response(null, { status: 429 });
      },
      async (ms) => {
        waits.push(ms);
      },
      3
    );
    expect(res.status).toBe(429);
    expect(calls).toBe(3);
    expect(waits).toEqual([250, 500]);
  });

  test('a miss or a hit is never retried', async () => {
    for (const status of [200, 404]) {
      let calls = 0;
      const res = await retryRateLimited(async () => {
        calls += 1;
        return new Response(null, { status });
      });
      expect(res.status).toBe(status);
      expect(calls).toBe(1);
    }
  });
});
