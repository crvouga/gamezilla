import { describe, expect, test } from 'bun:test';
import { languageOfName, withoutLanguageSuffix } from './languages';
import {
  categoryOfName,
  type NamedPackage,
  packageNameViolations,
} from './package-names';

/** `<tier>/<name>` with a matching scope. */
const pkg = (
  name: string,
  category: string,
  language: string,
  tier = 'pkgs'
): NamedPackage => ({
  dir: `${tier}/${name}`,
  name: `@${tier}/${name}`,
  category,
  language,
});

const check = (one: NamedPackage) => packageNameViolations([one]);

describe('a name spells runtime, then language', () => {
  test('suffix parsing', () => {
    expect(languageOfName('@pkgs/clock-shared-swift')).toBe('swift');
    expect(languageOfName('@pkgs/codegen-root-server-ts')).toBe('typescript');
    expect(languageOfName('@pkgs/game-protocol')).toBeUndefined();
    expect(withoutLanguageSuffix('@pkgs/clock-shared-swift')).toBe(
      '@pkgs/clock-shared'
    );
    expect(categoryOfName('@libs/chess-puzzle-client-ts')).toBe('client');
    expect(categoryOfName('@pkgs/sql-client-root-shared-ts')).toBe(
      'isomorphic'
    );
    expect(categoryOfName('@pkgs/clock-shared-swift')).toBe('isomorphic');
    expect(categoryOfName('@pkgs/friends-root-server-rust')).toBe('server');
    expect(categoryOfName('@libs/harness-ts')).toBe('harness');
    expect(categoryOfName('@pkgs/glicko2-ts')).toBeUndefined();
  });

  test('conforming names pass', () => {
    expect(
      check(pkg('codegen-root-server-ts', 'server', 'typescript'))
    ).toEqual([]);
    expect(check(pkg('clock-shared-swift', 'isomorphic', 'swift'))).toEqual([]);
    expect(check(pkg('sync-contracts', 'isomorphic', 'neutral'))).toEqual([]);
    // Apps name a product surface, not a runtime.
    expect(check(pkg('apple-client-swift', 'client', 'swift', 'apps'))).toEqual(
      []
    );
    expect(check(pkg('product-ts', 'harness', 'typescript', 'apps'))).toEqual(
      []
    );
  });

  test('the runtime suffix spells the category, before the language suffix', () => {
    expect(check(pkg('x-client-ts', 'server', 'typescript'))).toEqual([
      '@pkgs/x-client-ts is server, so its name ends in -server before any language suffix',
    ]);
    // No package is exempt, tooling included.
    expect(check(pkg('tools-ts', 'harness', 'typescript', 'libs'))).toEqual([
      '@libs/tools-ts is harness, so its name ends in -harness before any language suffix',
    ]);
  });

  test('every package ends in its language suffix: none means no language', () => {
    expect(check(pkg('new-shared', 'isomorphic', 'typescript'))).toEqual([
      '@pkgs/new-shared is typescript, so its name ends in -ts',
    ]);
    expect(check(pkg('product', 'harness', 'typescript', 'apps'))).toEqual([
      '@apps/product is typescript, so its name ends in -ts',
    ]);
    expect(check(pkg('clock-shared', 'isomorphic', 'swift'))).toEqual([
      '@pkgs/clock-shared is swift, so its name ends in -swift',
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
    const named = pkg('a-shared-ts', 'isomorphic', 'typescript');
    expect(check({ ...named, dir: 'libs/a-shared-ts' })).toEqual([
      'libs/a-shared-ts: @pkgs/a-shared-ts lives in libs/a-shared-ts, so it is named @libs/a-shared-ts',
    ]);
    expect(check({ ...named, dir: 'pkgs/b-shared-ts' })).toEqual([
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
    const one = pkg('value-shared-ts', 'isomorphic', 'typescript');
    expect(
      packageNameViolations([one, { ...one, dir: 'pkgs/value-shared-ts-copy' }])
    ).toContain(
      '@pkgs/value-shared-ts is the name of both pkgs/value-shared-ts and pkgs/value-shared-ts-copy'
    );
  });
});
