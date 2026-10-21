import { describe, expect, test } from 'bun:test';
import { languageOfName, withoutLanguageSuffix } from './languages';
import {
  categoryOfName,
  FROZEN_LEGACY_SIZE,
  type NamedPackage,
  packageNameViolations,
} from './package-names';

const LEGACY = ['@pkgs/value-shared'];
const VALUE: NamedPackage = {
  dir: 'pkgs/value-shared',
  name: '@pkgs/value-shared',
  category: 'isomorphic',
  language: 'typescript',
};

/** Violations of `pkg` in a workspace that also holds the legacy package. */
const check = (pkg: NamedPackage, legacy: readonly string[] = LEGACY) =>
  packageNameViolations([VALUE, pkg], legacy);

/** `pkgs/<name>` with a matching scope. */
const pkg = (
  name: string,
  category: string,
  language: string
): NamedPackage => ({
  dir: `pkgs/${name}`,
  name: `@pkgs/${name}`,
  category,
  language,
});

describe('a name spells runtime, then language', () => {
  test('suffix parsing', () => {
    expect(languageOfName('@pkgs/clock-shared-swift')).toBe('swift');
    expect(languageOfName('@pkgs/codegen-root-server-ts')).toBe('typescript');
    expect(languageOfName('@pkgs/game-protocol')).toBeUndefined();
    expect(withoutLanguageSuffix('@pkgs/clock-shared-swift')).toBe(
      '@pkgs/clock-shared'
    );
    expect(categoryOfName('@libs/chess-puzzle-client')).toBe('client');
    expect(categoryOfName('@pkgs/sql-client-root-shared')).toBe('isomorphic');
    expect(categoryOfName('@pkgs/clock-shared-swift')).toBe('isomorphic');
    expect(categoryOfName('@pkgs/friends-root-server-rust')).toBe('server');
    expect(categoryOfName('@libs/harness')).toBe('harness');
    expect(categoryOfName('@pkgs/glicko2')).toBeUndefined();
  });

  test('conforming names pass', () => {
    expect(
      check(pkg('codegen-root-server-ts', 'server', 'typescript'))
    ).toEqual([]);
    expect(check(pkg('clock-shared-swift', 'isomorphic', 'swift'))).toEqual([]);
    expect(check(pkg('sync-contracts', 'isomorphic', 'neutral'))).toEqual([]);
    expect(
      check({
        dir: 'apps/apple-client-swift',
        name: '@apps/apple-client-swift',
        category: 'client',
        language: 'swift',
      })
    ).toEqual([]);
  });

  test('the runtime suffix spells the category, before the language suffix', () => {
    expect(check(pkg('x-client-ts', 'server', 'typescript'))).toEqual([
      '@pkgs/x-client-ts is server, so its name ends in -server before any language suffix',
    ]);
    expect(check(pkg('x-ts-shared', 'isomorphic', 'typescript'))).toEqual([
      '@pkgs/x-ts-shared is typescript, so its name ends in -ts (only the frozen legacy-package-names.json may omit it)',
    ]);
    // Apps name a product surface, not a runtime.
    expect(
      check({
        dir: 'apps/product',
        name: '@apps/product',
        category: 'harness',
        language: 'typescript',
      })
    ).toEqual([
      '@apps/product is typescript, so its name ends in -ts (only the frozen legacy-package-names.json may omit it)',
    ]);
  });

  test('a new package ends in its language suffix; only the frozen list may not', () => {
    expect(check(pkg('new-shared', 'isomorphic', 'typescript'))).toEqual([
      '@pkgs/new-shared is typescript, so its name ends in -ts (only the frozen legacy-package-names.json may omit it)',
    ]);
    expect(check(pkg('clock-shared', 'isomorphic', 'swift'))).toEqual([
      '@pkgs/clock-shared is swift, so its name ends in -swift (only the frozen legacy-package-names.json may omit it)',
    ]);
  });

  test('a name never spells a language it does not declare', () => {
    expect(check(pkg('a-shared-swift', 'isomorphic', 'typescript'))).toEqual([
      '@pkgs/a-shared-swift is typescript but its name spells swift (-swift)',
    ]);
    expect(check(pkg('sync-contracts-ts', 'isomorphic', 'neutral'))).toEqual([
      '@pkgs/sync-contracts-ts is language-neutral, so its name ends in no language suffix (not -ts)',
    ]);
  });
});

describe('scope, directory and uniqueness', () => {
  test('the scope is the tier directory and the rest is the directory name', () => {
    expect(
      check({
        ...pkg('a-shared-ts', 'isomorphic', 'typescript'),
        dir: 'libs/a-shared-ts',
      })
    ).toEqual([
      'libs/a-shared-ts: @pkgs/a-shared-ts lives in libs/a-shared-ts, so it is named @libs/a-shared-ts',
    ]);
    expect(
      check({
        ...pkg('a-shared-ts', 'isomorphic', 'typescript'),
        dir: 'pkgs/b-shared-ts',
      })
    ).toEqual([
      'pkgs/b-shared-ts: @pkgs/a-shared-ts lives in pkgs/b-shared-ts, so it is named @pkgs/b-shared-ts',
    ]);
  });

  test('names are scoped lower-kebab-case', () => {
    for (const name of [
      'a-shared-ts',
      '@pkgs/A-shared-ts',
      '@pkgs/a_shared-ts',
      '@other/a-shared-ts',
      7,
    ])
      expect(
        check({
          dir: 'pkgs/a-shared-ts',
          name,
          category: 'isomorphic',
          language: 'typescript',
        })
      ).toEqual([expect.stringContaining('is not @pkgs/<lower-kebab-case>')]);
  });

  test('two packages never share a name', () => {
    expect(
      packageNameViolations(
        [VALUE, { ...VALUE, dir: 'pkgs/value-shared-copy' }],
        LEGACY
      )
    ).toContain(
      '@pkgs/value-shared is the name of both pkgs/value-shared and pkgs/value-shared-copy'
    );
  });
});

describe('the legacy list only shrinks', () => {
  test('it never grows past its frozen size', () => {
    const names = Array.from(
      { length: FROZEN_LEGACY_SIZE + 1 },
      (_, i) => `@pkgs/p${String(i).padStart(4, '0')}-shared`
    );
    const packages = names.map((name) => ({
      dir: name.slice(1),
      name,
      category: 'isomorphic',
      language: 'typescript',
    }));
    expect(packageNameViolations(packages, names)).toEqual([
      `legacy-package-names.json holds ${FROZEN_LEGACY_SIZE + 1} names but is frozen at ${FROZEN_LEGACY_SIZE}: a new package ends in its language suffix instead`,
    ]);
  });

  test('a renamed, deleted or non-TypeScript package leaves it', () => {
    const swift = pkg('clock-shared-swift', 'isomorphic', 'swift');
    const renamed = pkg('value-shared-ts', 'isomorphic', 'typescript');
    expect(
      packageNameViolations(
        [swift, renamed],
        [
          '@pkgs/clock-shared-swift',
          '@pkgs/gone-shared',
          '@pkgs/value-shared-ts',
        ]
      )
    ).toEqual([
      'legacy-package-names.json lists @pkgs/clock-shared-swift, which needs no exemption: delete the line',
      'legacy-package-names.json lists @pkgs/gone-shared, which no longer exists: delete the line',
      'legacy-package-names.json lists @pkgs/value-shared-ts, which needs no exemption: delete the line',
    ]);
  });

  test('it is sorted with each name once', () => {
    const b = pkg('b-shared', 'isomorphic', 'typescript');
    expect(
      packageNameViolations(
        [VALUE, b],
        ['@pkgs/value-shared', '@pkgs/b-shared']
      )
    ).toEqual(['legacy-package-names.json is sorted and holds each name once']);
  });
});
