import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scratchConfigSource } from './ci-i18n';
import {
  LINGUI_CATALOG_SOURCES,
  macrosOutsideCatalog,
  underCatalogSource,
} from './lingui-scope';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const MACRO = "import { t } from '@lingui/core/macro';";

describe('lingui catalog scope', () => {
  test('underCatalogSource matches files inside a source dir only', () => {
    expect(underCatalogSource('libs/spaces-client/src/x.tsx')).toBe(true);
    expect(underCatalogSource('libs/spaces-extra/src/x.tsx')).toBe(false);
    expect(underCatalogSource('apps/server/src/api.ts')).toBe(false);
  });

  test('macrosOutsideCatalog lists macro files the extractor would skip', () => {
    expect(
      macrosOutsideCatalog([
        { path: 'libs/spaces-client/src/spaces-screen.tsx', text: MACRO },
        { path: 'apps/server/src/untranslated.tsx', text: MACRO },
        { path: 'apps/server/src/plain.ts', text: 'export {};' },
        { path: 'apps/server/tests/fixture.test.tsx', text: MACRO },
      ])
    ).toEqual(['apps/server/src/untranslated.tsx']);
  });

  test('turbo hashes exactly the catalog sources for @libs/tools#ci:i18n', () => {
    const turbo = JSON.parse(
      readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
    ) as {
      readonly tasks: Record<string, { readonly inputs?: readonly string[] }>;
    };
    const inputs = turbo.tasks['@libs/tools#ci:i18n']?.inputs ?? [];
    const sources = inputs
      .filter((input) => input.endsWith('/**/*.{ts,tsx}'))
      .map((input) =>
        input
          .slice(0, -'/**/*.{ts,tsx}'.length)
          .replace(/^\$TURBO_ROOT\$\//, '')
      )
      .sort();
    expect(sources).toEqual([...LINGUI_CATALOG_SOURCES].sort());
  });
});

test('the freshness verification regenerates into scratch, never the committed catalog', () => {
  // regression: ci-i18n-rewrites-committed-catalog
  const source = scratchConfigSource('/repo');
  expect(source).toContain(
    "path: '<rootDir>/.cache/ci-i18n/{locale}/messages'"
  );
  expect(source).not.toContain('libs/app-root-shared/locales');
  expect(source).toContain('rootDir: "/repo"');
});
