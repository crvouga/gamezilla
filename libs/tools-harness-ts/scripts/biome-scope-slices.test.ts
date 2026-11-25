import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
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

// regression: biome-symlinked-skill-scripts
test('a path Biome skips stays skipped when reached through a tracked symlink', () => {
  const root = join(import.meta.dirname, '../../..');
  const excluded = (
    JSON.parse(readFileSync(join(root, 'biome.json'), 'utf8')) as {
      files: { includes: string[] };
    }
  ).files.includes
    .filter((entry) => entry.startsWith('!') && !entry.startsWith('!!'))
    .map((entry) => entry.slice(1));
  const covered = (path: string) =>
    excluded.some((entry) => path === entry || path.startsWith(`${entry}/`));
  const links = execFileSync('git', ['ls-files', '-s'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\n')
    .filter((line) => line.startsWith('120000 '))
    .map((line) => line.split('\t')[1] ?? '');
  const leaks = links.flatMap((link) => {
    const target = normalize(
      join(dirname(link), readlinkSync(join(root, link)))
    );
    return excluded
      .filter((entry) => entry.startsWith(`${target}/`))
      .map((entry) => `${link}${entry.slice(target.length)}`)
      .filter((alias) => !covered(alias));
  });
  expect(leaks).toEqual([]);
});
