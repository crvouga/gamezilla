import { describe, expect, test } from 'bun:test';
import {
  catalogIncludeRelPaths,
  macrosOutsideCatalogInclude,
  posixUnderInclude,
} from './ci-i18n';

describe('ci-i18n catalog include', () => {
  test('strips <rootDir>/ from lingui catalog include paths', () => {
    expect(
      catalogIncludeRelPaths({
        catalogs: [{ include: ['<rootDir>/libs', '<rootDir>/pkgs'] }],
      })
    ).toEqual(['libs', 'pkgs']);
  });

  test('posixUnderInclude matches files inside an include dir', () => {
    expect(
      posixUnderInclude('libs/spaces/src/root/client/spaces-screen.tsx', [
        'libs',
      ])
    ).toBe(true);
    expect(
      posixUnderInclude('apps/server/src/api.ts', ['apps/client/src'])
    ).toBe(false);
  });

  test('macrosOutsideCatalogInclude lists files the extractor would skip', () => {
    expect(
      macrosOutsideCatalogInclude(
        [
          'libs/spaces/src/root/client/spaces-screen.tsx',
          'apps/server/src/untranslated.tsx',
        ],
        ['libs', 'apps/client/src']
      )
    ).toEqual(['apps/server/src/untranslated.tsx']);
  });
});
