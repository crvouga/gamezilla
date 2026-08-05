import { describe, expect, test } from 'bun:test';

import {
  filterCatalogItems,
  flattenCatalogItems,
  groupCatalogItems,
  resolveCatalogNeighbor,
  type CatalogItem,
} from './catalog-item';

const ITEMS: readonly CatalogItem[] = [
  { id: 'a', label: 'Alpha', category: 'One' },
  { id: 'b', label: 'Beta', category: 'Two' },
  { id: 'c', label: 'Gamma', category: 'One' },
  { id: 'd', label: 'Delta' },
];

describe('filterCatalogItems', () => {
  test('matches label case-insensitively', () => {
    expect(filterCatalogItems(ITEMS, 'alp').map((i) => i.id)).toEqual(['a']);
  });

  test('matches category', () => {
    expect(filterCatalogItems(ITEMS, 'two').map((i) => i.id)).toEqual(['b']);
  });

  test('empty query returns all', () => {
    expect(filterCatalogItems(ITEMS, '  ')).toHaveLength(ITEMS.length);
  });
});

describe('groupCatalogItems', () => {
  test('preserves first-seen category order and trailing uncategorized', () => {
    const groups = groupCatalogItems(ITEMS);
    expect(groups.map((g) => g.category)).toEqual(['One', 'Two', null]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groups[2]?.items.map((i) => i.id)).toEqual(['d']);
  });
});

describe('flattenCatalogItems / resolveCatalogNeighbor', () => {
  test('flattens in list render order', () => {
    expect(flattenCatalogItems(ITEMS).map((i) => i.id)).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  test('clamps prev/next at ends', () => {
    const first = resolveCatalogNeighbor(ITEMS, 'a');
    expect(first.prev).toBeNull();
    expect(first.next?.id).toBe('c');
    expect(first.index).toBe(0);

    const last = resolveCatalogNeighbor(ITEMS, 'd');
    expect(last.next).toBeNull();
    expect(last.prev?.id).toBe('b');
  });

  test('unknown id has null current', () => {
    const miss = resolveCatalogNeighbor(ITEMS, 'missing');
    expect(miss.current).toBeNull();
    expect(miss.index).toBe(-1);
  });
});
