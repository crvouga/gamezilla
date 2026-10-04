import { describe, expect, test } from 'bun:test';
import type { CatalogItem } from '@pkgs/ui-shared/catalog-item';
import { filterCatalogItems, flattenCatalogItems, groupCatalogItems, resolveCatalogNeighbor } from '@pkgs/ui-shared/catalog-item';

const ITEMS: readonly CatalogItem[] = [
  { id: 'btn', label: 'Button', category: 'Inputs' },
  { id: 'misc', label: 'Misc thing' },
  { id: 'badge', label: 'Badge', category: 'Data display' },
  { id: 'chk', label: 'Checkbox', category: 'Inputs' },
];

describe('filterCatalogItems', () => {
  test('blank query returns a copy of everything', () => {
    const out = filterCatalogItems(ITEMS, '   ');
    expect(out).toEqual([...ITEMS]);
    expect(out).not.toBe(ITEMS);
  });

  test('matches label or category, case-insensitively', () => {
    expect(filterCatalogItems(ITEMS, 'BUTT').map((i) => i.id)).toEqual(['btn']);
    expect(filterCatalogItems(ITEMS, 'inputs').map((i) => i.id)).toEqual([
      'btn',
      'chk',
    ]);
    expect(filterCatalogItems(ITEMS, 'zzz')).toEqual([]);
  });
});

describe('groupCatalogItems / flattenCatalogItems', () => {
  test('groups by first-seen category with uncategorized trailing', () => {
    const groups = groupCatalogItems(ITEMS);
    expect(groups.map((g) => g.category)).toEqual([
      'Inputs',
      'Data display',
      null,
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['btn', 'chk']);
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['misc']);
  });

  test('omits the uncategorized group when empty', () => {
    const groups = groupCatalogItems(ITEMS.filter((i) => i.category));
    expect(groups.some((g) => g.category === null)).toBe(false);
  });

  test('flatten follows grouped render order', () => {
    expect(flattenCatalogItems(ITEMS).map((i) => i.id)).toEqual([
      'btn',
      'chk',
      'badge',
      'misc',
    ]);
  });
});

describe('resolveCatalogNeighbor', () => {
  test('prev/next in flattened order, clamped at the ends', () => {
    const first = resolveCatalogNeighbor(ITEMS, 'btn');
    expect(first.index).toBe(0);
    expect(first.total).toBe(4);
    expect(first.prev).toBeNull();
    expect(first.next?.id).toBe('chk');

    const mid = resolveCatalogNeighbor(ITEMS, 'badge');
    expect(mid.prev?.id).toBe('chk');
    expect(mid.next?.id).toBe('misc');

    const last = resolveCatalogNeighbor(ITEMS, 'misc');
    expect(last.next).toBeNull();
    expect(last.current?.label).toBe('Misc thing');
  });

  test('unknown id yields index -1 with no neighbors', () => {
    expect(resolveCatalogNeighbor(ITEMS, 'nope')).toEqual({
      index: -1,
      total: 4,
      prev: null,
      next: null,
      current: null,
    });
  });
});
