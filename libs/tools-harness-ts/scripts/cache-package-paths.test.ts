import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');
type Config = {
  tasks: Record<string, { inputs?: string[]; dependsOn?: string[] }>;
};

// regression: flattened-checker-cache-dependencies
test('cache inputs reference existing package owners after package splits', () => {
  const paths = [
    'turbo.json',
    ...new Bun.Glob('{apps,libs,pkgs}/*/turbo.json').scanSync({ cwd: ROOT }),
  ];
  for (const path of paths) {
    const config = JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Config;
    for (const [task, definition] of Object.entries(config.tasks)) {
      for (const input of definition.inputs ?? []) {
        const owner =
          /^!?\$TURBO_ROOT\$\/((?:apps|libs|pkgs)\/[^/*?{]+)\//.exec(
            input
          )?.[1];
        if (owner)
          expect(
            existsSync(join(ROOT, owner, 'package.json')),
            `${path}: ${task}: ${input}`
          ).toBe(true);
      }
    }
  }
});

// regression: flattened-checker-cache-dependencies
test('model verdicts depend on the split checker and evidence implementations', () => {
  const config = JSON.parse(
    readFileSync(join(ROOT, 'turbo.json'), 'utf8')
  ) as Config;
  expect(config.tasks['verify:models']!.dependsOn).toEqual([
    '@pkgs/quint-server-ts#src',
    '@pkgs/quint-shared-ts#src',
    '@pkgs/conformance-server-ts#src',
    '@pkgs/conformance-shared-ts#src',
  ]);
});

/**
 * These tests scan every workspace manifest for the `game` / `gameRegistry`
 * markers, so a game package's `package.json` is an input. They name those
 * manifests instead of globbing every `package.json`: an edit to a manifest
 * with no marker (a dependency bump in an unrelated package) would otherwise
 * rerun every one of them. A new game package must be added to the lists, and
 * this test says which.
 */
const GAME_MANIFEST_TASKS: ReadonlyArray<readonly [string, readonly string[]]> =
  [
    [
      'turbo.json',
      [
        '@apps/client-ts#test',
        '@libs/games-harness-ts#test',
        '@libs/games-harness-ts#test:contract',
      ],
    ],
    [
      'libs/games-harness-ts/turbo.json',
      [
        'test',
        'test:contract:0',
        'test:contract:1',
        'test:contract:2',
        'test:contract:3',
        'test:contract:4',
      ],
    ],
  ];

test('tests that scan manifests for game markers list every marked manifest and no others', () => {
  const marked = [
    ...new Bun.Glob('{apps,libs,pkgs}/*/package.json').scanSync({ cwd: ROOT }),
  ]
    .filter((path) =>
      /"(game|gameRegistry)"/.test(readFileSync(join(ROOT, path), 'utf8'))
    )
    .sort();
  expect(marked.length).toBeGreaterThan(0);
  for (const [file, tasks] of GAME_MANIFEST_TASKS) {
    const config = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as Config;
    for (const task of tasks) {
      const manifests = (config.tasks[task]?.inputs ?? [])
        .filter((input) => input.endsWith('/package.json'))
        .map((input) => input.replace('$TURBO_ROOT$/', ''));
      const covered = new Set(
        manifests.flatMap((pattern) =>
          [
            ...new Bun.Glob('{apps,libs,pkgs}/*/package.json').scanSync({
              cwd: ROOT,
            }),
          ].filter((path) => new Bun.Glob(pattern).match(path))
        )
      );
      expect(
        marked.filter((path) => !covered.has(path)),
        `${file}: ${task} leaves a game manifest out`
      ).toEqual([]);
      expect(
        [...covered].filter((path) => !marked.includes(path)),
        `${file}: ${task} lists a manifest with no game marker`
      ).toEqual([]);
    }
  }
});

/** Relative imports reachable from `entry`, as repo-relative paths. */
function relativeImportClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const [, specifier] of source.matchAll(
      /(?:from|import\()\s*['"](\.[^'"]*)['"]/g
    )) {
      const base = join(file, '..', specifier!);
      const found = [base, `${base}.ts`, `${base}.tsx`].find(
        (path) => path.endsWith('.ts') && existsSync(join(ROOT, path))
      );
      if (found !== undefined) queue.push(found);
    }
  }
  return seen;
}

test('every script lint-package.ts reaches is a lint input', () => {
  const config = JSON.parse(
    readFileSync(join(ROOT, 'turbo.json'), 'utf8')
  ) as Config;
  const inputs = (config.tasks['lint']?.inputs ?? []).map((input) =>
    input.replace('$TURBO_ROOT$/', '')
  );
  const missing = [
    ...relativeImportClosure('libs/tools-harness-ts/scripts/lint-package.ts'),
  ].filter((file) => !inputs.some((input) => new Bun.Glob(input).match(file)));
  expect(missing).toEqual([]);
});
