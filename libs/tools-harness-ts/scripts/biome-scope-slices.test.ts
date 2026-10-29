import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deriveFromBiomeJson,
  mergedLists,
  sliceDrift,
  sortedLists,
  splitBiomeConfig,
} from './biome-scope-slices';

const WORKSPACE = new Set(['pkgs/a', 'pkgs/b']);

test('an entry naming one package moves to that package and the rest stays shared', () => {
  const { shared, slices } = splitBiomeConfig(
    {
      files: { includes: ['**', '!pkgs/a/generated/**'] },
      plugins: [
        'a.grit',
        {
          path: './x.grit',
          includes: [
            '**/*.ts',
            '**/pkgs/a/src/**/*.ts',
            '!**/pkgs/b/src/legacy.ts',
            '!**/*.test.ts',
            '**/pkgs/gone/src/**',
          ],
        },
      ],
    },
    WORKSPACE
  );
  expect(shared).toEqual({
    files: { includes: ['**'] },
    plugins: [
      'a.grit',
      {
        path: './x.grit',
        includes: ['**/*.ts', '!**/*.test.ts', '**/pkgs/gone/src/**'],
      },
    ],
  });
  expect(Object.fromEntries(slices)).toEqual({
    'pkgs/a': {
      files: ['!pkgs/a/generated/**'],
      'plugin:./x.grit': ['**/pkgs/a/src/**/*.ts'],
    },
    'pkgs/b': { 'plugin:./x.grit': ['!**/pkgs/b/src/legacy.ts'] },
  });
});

test('the shared config and the slices hold every entry of biome.json', () => {
  const derived = deriveFromBiomeJson();
  const original = splitBiomeConfig(
    JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../biome.json'), 'utf8')
    ) as Parameters<typeof splitBiomeConfig>[0],
    new Set()
  ).shared;
  expect(mergedLists(derived.shared, derived.slices)).toEqual(
    sortedLists(original)
  );
});

test('biome.shared.json and each package biome-scope.json match biome.json', () => {
  expect(
    sliceDrift(),
    'run `bun run libs/tools-harness-ts/scripts/biome-scope-slices.ts`'
  ).toEqual([]);
});
