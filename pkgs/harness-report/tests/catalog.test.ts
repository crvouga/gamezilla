import { describe, expect, test } from 'bun:test';

import {
  arrangeCatalog,
  type CatalogEntity,
  type CatalogQuery,
  catalogCounts,
  catalogParams,
} from '../src/lib/catalog';

function entity(
  patch: Partial<CatalogEntity> & Pick<CatalogEntity, 'id' | 'title'>
): CatalogEntity {
  return {
    status: 'passed',
    durationMs: 10,
    file: 'tests/a.test.ts',
    packageName: 'libs-chess',
    runtime: 'sim',
    detail: '',
    search: patch.title,
    href: null,
    ...patch,
  };
}

const QUERY: CatalogQuery = {
  q: '',
  status: 'all',
  group: 'none',
  sort: 'recent',
};

describe('report catalog', () => {
  const entities = [
    entity({
      id: 'a',
      title: 'puts a value',
      status: 'failed',
      durationMs: 40,
      packageName: 'libs-chess',
      search: 'puts a value kv',
    }),
    entity({
      id: 'b',
      title: 'opens a room',
      status: 'passed',
      durationMs: 5,
      packageName: 'libs-rooms',
      search: 'opens a room',
    }),
    entity({
      id: 'c',
      title: 'skipped case',
      status: 'skipped',
      durationMs: null,
      packageName: '',
      search: 'skipped case',
    }),
  ];

  test('counts each status and keeps the list filters that are set', () => {
    expect(catalogCounts(entities)).toEqual({
      all: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
      running: 0,
    });
    expect(
      catalogParams({ q: 'kv', status: '', group: 'package', frame: '2' })
    ).toEqual({ q: 'kv', group: 'package' });
  });

  test('failed tests sort first, and a search hides the rest', () => {
    const byStatus = arrangeCatalog(entities, { ...QUERY, sort: 'status' });
    expect(byStatus[0]?.entities.map((item) => item.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    const found = arrangeCatalog(entities, { ...QUERY, q: 'kv' });
    expect(found[0]?.entities.map((item) => item.id)).toEqual(['a']);
  });

  test('groups by package, sums duration, and leaves Other last', () => {
    const groups = arrangeCatalog(entities, {
      ...QUERY,
      group: 'package',
      sort: 'duration',
    });
    expect(groups.map((group) => group.name)).toEqual([
      'libs-chess',
      'libs-rooms',
      'Other',
    ]);
    expect(groups[0]?.durationMs).toBe(40);
    expect(groups[0]?.failed).toBe(1);
    expect(groups[0]?.entities[0]?.id).toBe('a');
  });

  test('recent keeps the order the report arrived in', () => {
    const groups = arrangeCatalog(entities, QUERY);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('All');
    expect(groups[0]?.entities.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
