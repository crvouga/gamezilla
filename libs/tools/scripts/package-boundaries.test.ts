import { describe, expect, test } from 'bun:test';
import {
  categoryOfName,
  categoryViolations,
  familyOf,
} from './package-boundaries';

const lib = { tier: 'libs', hasSrc: true, sources: [] };

describe('package categories', () => {
  test('the name spells the category', () => {
    expect(categoryOfName('@libs/chess-puzzle-client')).toBe('client');
    expect(categoryOfName('@libs/chess-shared-server')).toBe('server');
    expect(categoryOfName('@pkgs/sql-client-shared')).toBe('isomorphic');
    expect(categoryOfName('@libs/harness')).toBe('harness');
    expect(categoryOfName('@pkgs/glicko2')).toBeUndefined();
  });

  test('a package declares a category its name agrees with', () => {
    expect(categoryViolations({ name: '@libs/x-client' }, lib)).toEqual([
      'package.json declares no category (one of client, server, isomorphic, harness)',
    ]);
    expect(
      categoryViolations({ name: '@libs/x-client', category: 'server' }, lib)
    ).toEqual(['@libs/x-client is server, so its name ends in -server']);
    expect(
      categoryViolations({ name: '@apps/product', category: 'harness' }, { ...lib, tier: 'apps' })
    ).toEqual([]);
  });

  test('client and server never meet; isomorphic depends on isomorphic only', () => {
    const deps = (category: string, dep: string) =>
      categoryViolations(
        { name: `@libs/x-${category === 'isomorphic' ? 'shared' : category}`, category, dependencies: { [dep]: 'workspace:*' } },
        lib
      );
    expect(deps('client', '@libs/y-server')).toEqual(['client package depends on server @libs/y-server']);
    expect(deps('server', '@libs/y-client')).toEqual(['server package depends on client @libs/y-client']);
    expect(deps('isomorphic', '@libs/y-client')).toEqual(['isomorphic package depends on client @libs/y-client']);
    expect(deps('isomorphic', '@libs/y-server')).toEqual(['isomorphic package depends on server @libs/y-server']);
    expect(deps('client', '@libs/y-shared')).toEqual([]);
    expect(deps('harness', '@libs/y-server')).toEqual([]);
  });

  test('only a harness depends on a harness, even for tests', () => {
    expect(
      categoryViolations(
        { name: '@libs/x-client', category: 'client', devDependencies: { '@libs/y-harness': 'workspace:*' } },
        lib
      )
    ).toEqual(['devDependencies names harness @libs/y-harness: only a harness depends on a harness']);
    expect(
      categoryViolations(
        { name: '@libs/x-client', category: 'client', devDependencies: { '@libs/y-server': 'workspace:*' } },
        lib
      )
    ).toEqual([]);
  });

  test('isomorphic source loads nothing that runs on one side only', () => {
    const sources = [
      { path: 'src/a.ts', text: "import { createSignal } from 'solid-js';\n" },
      { path: 'src/b.ts', text: "import { readFileSync } from 'node:fs';\n" },
      { path: 'src/c.ts', text: "import type { JSX } from 'solid-js';\n" },
    ];
    expect(
      categoryViolations({ name: '@libs/x-shared', category: 'isomorphic' }, { ...lib, sources })
    ).toEqual([
      'src/a.ts loads solid-js, which does not run everywhere',
      'src/b.ts loads node:fs, which does not run everywhere',
    ]);
  });

  test('families group a feature across its slices', () => {
    expect(familyOf('@libs/chess-puzzle-client')).toBe('chess');
    expect(familyOf('@libs/app-config-shared')).toBe('app-config');
    expect(familyOf('@libs/app-client')).toBe('app');
    expect(familyOf('@libs/user-search-client')).toBe('user-search');
    expect(familyOf('@pkgs/ui-client')).toBeUndefined();
  });
});
