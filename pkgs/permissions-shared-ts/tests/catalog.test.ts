import { describe, expect, test } from 'bun:test';

import type { CatalogValue } from '@pkgs/permissions-shared-ts/catalog';
import { defineCatalog } from '@pkgs/permissions-shared-ts/catalog';

const CATALOG = defineCatalog({
  friendsUse: 'friends:use',
  spacesHost: 'spaces:host',
});

describe('defineCatalog', () => {
  test('keeps literal values and freezes the map', () => {
    expect(CATALOG.friendsUse).toBe('friends:use');
    expect(CATALOG.spacesHost).toBe('spaces:host');
    expect(Object.isFrozen(CATALOG)).toBe(true);
    expect(Object.keys(CATALOG)).toEqual(['friendsUse', 'spacesHost']);
  });

  test('the catalog value type is the value union', () => {
    const value: CatalogValue<typeof CATALOG> = 'spaces:host';
    expect(value).toBe(CATALOG.spacesHost);
  });
});
