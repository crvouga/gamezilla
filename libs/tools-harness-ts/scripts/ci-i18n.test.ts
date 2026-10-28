import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linguiCommand, scratchConfigSource } from './ci-i18n';
import {
  LINGUI_CATALOG_SOURCES,
  macrosOutsideCatalog,
  underCatalogSource,
} from './lingui-scope';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const MACRO = "import { t } from '@lingui/core/macro';";

describe('lingui catalog scope', () => {
  test('underCatalogSource matches files inside a source dir only', () => {
    expect(underCatalogSource('libs/spaces-client-ts/src/x.tsx')).toBe(true);
    expect(underCatalogSource('libs/spaces-extra/src/x.tsx')).toBe(false);
    expect(underCatalogSource('apps/server-ts/src/api.ts')).toBe(false);
  });

  test('macrosOutsideCatalog lists macro files the extractor would skip', () => {
    expect(
      macrosOutsideCatalog([
        { path: 'libs/spaces-client-ts/src/spaces-screen.tsx', text: MACRO },
        { path: 'apps/server-ts/src/untranslated.tsx', text: MACRO },
        { path: 'apps/server-ts/src/plain.ts', text: 'export {};' },
        { path: 'apps/server-ts/tests/fixture.test.tsx', text: MACRO },
      ])
    ).toEqual(['apps/server-ts/src/untranslated.tsx']);
  });

  test('turbo hashes exactly the catalog sources for @libs/tools-harness-ts#ci:i18n', () => {
    const turbo = JSON.parse(
      readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
    ) as {
      readonly tasks: Record<string, { readonly inputs?: readonly string[] }>;
    };
    const inputs = turbo.tasks['@libs/tools-harness-ts#ci:i18n']?.inputs ?? [];
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
  expect(source).not.toContain('libs/app-root-shared-ts/locales');
  expect(source).toContain('rootDir: "/repo"');
});

test('the Lingui subcommands run as scripts under this Bun, never through bunx', () => {
  // regression: ci-i18n-bunx-reads-extractor-path-as-package
  const dist = 'C:/repo/node_modules/@lingui/cli/dist';
  const command = linguiCommand('C:/bun/bun.exe', dist, 'extract', ['--clean']);
  expect(command.cmd).toBe('C:/bun/bun.exe');
  expect(command.args[0]?.replaceAll('\\', '/')).toBe(
    `${dist}/lingui-extract.js`
  );
  expect(command.args.slice(1)).toEqual(['--clean']);
  expect(command.cmd).not.toContain('bunx');
  expect(command.args).not.toContain('lingui');
});
