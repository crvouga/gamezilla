/**
 * Meta-tests for the edge-case catalog + coverage completeness.
 */

import { describe, expect, test } from 'bun:test';
import { COVERED_IDS } from './catalog-coverage';
import type { CatalogFamily } from './edge-case-catalog';
import { CATALOG_IDS, EDGE_CASE_CATALOG } from './edge-case-catalog';

const FAMILIES: readonly CatalogFamily[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
];

describe('edge-case catalog meta', () => {
  test('unique ids, non-empty titles, all families present', () => {
    const ids = EDGE_CASE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...CATALOG_IDS]);
    for (const entry of EDGE_CASE_CATALOG) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.id.startsWith(`${entry.family}.`)).toBe(true);
    }
    const present = new Set(EDGE_CASE_CATALOG.map((e) => e.family));
    for (const family of FAMILIES) {
      expect(present.has(family)).toBe(true);
    }
  });

  test('every catalog id appears in COVERED_IDS', () => {
    const missing = CATALOG_IDS.filter((id) => !COVERED_IDS.has(id));
    expect(missing).toEqual([]);
    expect(COVERED_IDS.size).toBeGreaterThanOrEqual(CATALOG_IDS.length);
  });
});
