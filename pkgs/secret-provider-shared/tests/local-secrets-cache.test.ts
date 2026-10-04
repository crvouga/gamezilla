import { describe, expect, it } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';
import { isSecretsCacheEnv, isSecretsCacheStale, mergeSecretsIntoEnv, parseInfisicalExportJson, readSecretsCacheMap, readSecretsCacheMeta, writeSecretsCacheMap, writeSecretsCacheMeta } from '@pkgs/secret-provider-shared/local-secrets-cache';

describe('parseInfisicalExportJson', () => {
  it('parses Infisical export array into a map', () => {
    const map = parseInfisicalExportJson(
      JSON.stringify([
        { key: 'TURBO_TOKEN', value: 'tok' },
        { key: 'TURBO_TEAM', value: 'team' },
        { key: 'skip', value: 1 },
      ])
    );
    expect(map.get('TURBO_TOKEN')).toBe('tok');
    expect(map.get('TURBO_TEAM')).toBe('team');
    expect(map.has('skip')).toBe(false);
  });

  it('returns empty map for empty or non-array JSON', () => {
    expect(parseInfisicalExportJson('').size).toBe(0);
    expect(parseInfisicalExportJson('{}').size).toBe(0);
  });
});

describe('local secrets cache ObjectStore round-trip', () => {
  it('writes and reads env maps and meta', async () => {
    const store = new ObjectStoreImplInMemory();
    const map = new Map([
      ['A', '1'],
      ['B', '2'],
    ]);
    await writeSecretsCacheMap(store, 'dev', map);
    await writeSecretsCacheMap(store, 'prd', new Map([['A', 'prd']]));
    await writeSecretsCacheMeta(store, {
      pulledAt: '2026-01-01T00:00:00.000Z',
      projectId: 'proj',
      envs: ['dev', 'prd'],
    });

    const dev = await readSecretsCacheMap(store, 'dev');
    expect(dev?.get('A')).toBe('1');
    expect(dev?.get('B')).toBe('2');
    expect((await readSecretsCacheMap(store, 'prd'))?.get('A')).toBe('prd');

    const meta = await readSecretsCacheMeta(store);
    expect(meta?.projectId).toBe('proj');
    expect(meta?.envs).toEqual(['dev', 'prd']);
  });
});

describe('secrets cache environments', () => {
  it('caches any environment slug the caller names', async () => {
    const store = new ObjectStoreImplInMemory();
    await writeSecretsCacheMap(store, 'staging', new Map([['A', 'stg']]));
    await writeSecretsCacheMap(store, 'preview-42', new Map([['A', 'pr']]));
    await writeSecretsCacheMeta(store, {
      pulledAt: '2026-01-01T00:00:00.000Z',
      projectId: 'proj',
      envs: ['dev', 'staging', 'preview-42'],
    });
    expect((await readSecretsCacheMap(store, 'staging'))?.get('A')).toBe('stg');
    expect((await readSecretsCacheMap(store, 'preview-42'))?.get('A')).toBe(
      'pr'
    );
    expect((await readSecretsCacheMeta(store))?.envs).toEqual([
      'dev',
      'staging',
      'preview-42',
    ]);
  });

  it('refuses a name that is not a slug (it becomes a file path)', async () => {
    const store = new ObjectStoreImplInMemory();
    for (const bad of ['../prd', 'Staging', '', 'a/b']) {
      expect(isSecretsCacheEnv(bad)).toBe(false);
      await expect(readSecretsCacheMap(store, bad)).rejects.toThrow(
        /not an environment slug/
      );
    }
  });
});

describe('isSecretsCacheStale', () => {
  it('is stale when older than ttl', () => {
    const meta = {
      pulledAt: '2026-01-01T00:00:00.000Z',
      projectId: 'p',
      envs: ['dev'] as const,
    };
    const pulled = Date.parse(meta.pulledAt);
    expect(isSecretsCacheStale(meta, pulled + 1000, 500)).toBe(true);
    expect(isSecretsCacheStale(meta, pulled + 100, 500)).toBe(false);
  });

  it('is stale when pulledAt is unparseable', () => {
    expect(
      isSecretsCacheStale(
        { pulledAt: 'nope', projectId: 'p', envs: ['dev'] },
        1_000_000
      )
    ).toBe(true);
  });
});

describe('mergeSecretsIntoEnv', () => {
  it('overwrites with cache keys without wiping unrelated env', () => {
    const merged = mergeSecretsIntoEnv(
      { KEEP: 'yes', TURBO_TOKEN: 'old' },
      new Map([['TURBO_TOKEN', 'new']])
    );
    expect(merged['KEEP']).toBe('yes');
    expect(merged['TURBO_TOKEN']).toBe('new');
  });
});
