import { describe, expect, test } from 'bun:test';

import {
  artifactUrl,
  type PrefetchIo,
  planFromDryRun,
  prefetchArtifacts,
} from './turbo-preflight';

function dryRun(tasks: readonly unknown[]): string {
  return JSON.stringify({ id: 'run', tasks });
}

describe('planFromDryRun', () => {
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

describe('prefetchArtifacts', () => {
  test('writes turbo local-cache layout: tar then meta', async () => {
    const { io, files } = memoryIo({ aaa: 'tar-bytes' });
    const result = await prefetchArtifacts(['aaa'], '/cache', io, 4);
    expect(result).toEqual({ fetched: 1, failed: 0 });
    expect([...files.keys()]).toEqual([
      '/cache/aaa.tar.zst',
      '/cache/aaa-meta.json',
    ]);
    expect(files.get('/cache/aaa.tar.zst')).toBe('tar-bytes');
    expect(JSON.parse(files.get('/cache/aaa-meta.json') ?? '')).toEqual({
      hash: 'aaa',
      duration: 0,
    });
  });

  test('skips hashes already cached locally', async () => {
    const { io, files, fetches } = memoryIo({ aaa: 'new' });
    files.set('/cache/aaa.tar.zst', 'old');
    const result = await prefetchArtifacts(['aaa'], '/cache', io, 4);
    expect(result).toEqual({ fetched: 1, failed: 0 });
    expect(fetches).toEqual([]);
    expect(files.get('/cache/aaa.tar.zst')).toBe('old');
  });

  test('counts missing and failing artifacts without writing them', async () => {
    const { io, files } = memoryIo({ aaa: 'a', ccc: 'c' });
    const result = await prefetchArtifacts(
      ['aaa', 'gone', 'boom', 'ccc'],
      '/cache',
      io,
      2
    );
    expect(result).toEqual({ fetched: 2, failed: 2 });
    expect([...files.keys()].sort()).toEqual([
      '/cache/aaa-meta.json',
      '/cache/aaa.tar.zst',
      '/cache/ccc-meta.json',
      '/cache/ccc.tar.zst',
    ]);
  });
});
