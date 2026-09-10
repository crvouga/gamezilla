/**
 * Explicit coverage set: every catalog id that has a smoke/contract fixture.
 * Populated from catalog-fixtures-data (one fixture per id).
 */

import { CATALOG_FIXTURES } from './catalog-fixtures-data';

export const COVERED_IDS: ReadonlySet<string> = new Set(
  CATALOG_FIXTURES.map((f) => f.id)
);
