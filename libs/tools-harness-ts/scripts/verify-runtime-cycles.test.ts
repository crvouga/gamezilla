// @io-wall-ok — exercise the Nightly check against real, tracked module paths.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { verifyRuntimeCycles } from './verify-runtime-cycles';
import { REPO_ROOT } from './workspace-package-import-graph';

function check(files: Record<string, string>): string {
  const cache = join(REPO_ROOT, '.cache');
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, 'runtime-cycles-'));
  try {
    mkdirSync(join(root, 'pkgs'));
    for (const [path, text] of Object.entries({
      'apps/a/package.json': JSON.stringify({
        name: '@apps/a',
        exports: { './*': ['./src/*.ts', './src/*/index.ts'] },
      }),
      'libs/b/package.json':
        '{"name":"@libs/b","exports":{"./value":"./src/value.ts"}}',
      ...files,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    return verifyRuntimeCycles(root);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
}

test('a fixture can close a package cycle through different, individually acyclic modules', () => {
  expect(() =>
    check({
      'apps/a/src/value.ts': "export { b } from '@libs/b/value';",
      'apps/a/src/leaf/index.ts': 'export const a = 1;',
      'libs/b/src/value.ts': 'export const b = 2;',
      'libs/b/tests/fixture.js': "import '@apps/a/leaf';",
    })
  ).toThrow(
    /1 package cycle groups[\s\S]*0 module cycle groups[\s\S]*@apps\/a, @libs\/b/
  );
});

test('a literal dynamic import and a self export close a cycle across JavaScript and TypeScript', () => {
  expect(() =>
    check({
      'apps/a/src/leaf/index.ts':
        "export const load = () => import('../../worker.cjs');",
      'apps/a/worker.cjs': "module.exports = require('@apps/a/leaf');",
    })
  ).toThrow(
    /0 package cycle groups[\s\S]*1 module cycle groups[\s\S]*apps\/a\/src\/leaf\/index.ts, apps\/a\/worker.cjs/
  );
});

test('a direct JavaScript self-import fails the module check', () => {
  expect(() => check({ 'apps/a/src/self.js': "import './self.js';" })).toThrow(
    /1 module cycle groups[\s\S]*apps\/a\/src\/self.js/
  );
});

test('acyclic imports pass with type-only back references, computed targets and missing files', () => {
  const report = check({
    'apps/a/src/leaf/index.ts': "export { b } from '@libs/b/value';",
    'apps/a/src/main.ts':
      "import './leaf'; import('./not-generated'); import(computed);",
    'libs/b/src/value.ts':
      "export type { T } from '@apps/a/leaf'; export const b = 1;",
    'apps/a/src/types.d.ts': "import './types.d.ts';",
  });
  expect(report).toContain('1 intra-package edges, 0 module cycle groups');
  expect(report).toContain(
    '1 unresolved relative or self-package references\napps/a/src/main.ts -> ./not-generated'
  );
});
