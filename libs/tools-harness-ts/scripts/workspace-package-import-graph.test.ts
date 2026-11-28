// @io-wall-ok — verifies source discovery in a disposable tracked workspace.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { cycleGroups, packageReport, packageEdges, REPO_ROOT } from './workspace-package-import-graph';

test('dependency reports separate a shared dependency from mutually dependent packages', () => {
  const graph = new Map([
    ['shell', ['a', 'clock']],
    ['a', ['b']],
    ['b', ['a', 'clock']],
    ['clock', []],
    ['unused', []],
  ]);
  expect(cycleGroups(graph)).toEqual([['a', 'b']]);
  expect(packageReport(graph, 'clock')).toEqual({
    name: 'clock',
    dependencies: [],
    dependents: ['b', 'shell'],
  });
  expect(() => packageReport(graph, 'typo')).toThrow(
    'Unknown workspace package'
  );
});

// regression: package-graph-reports-test-import-as-production
test('the source graph excludes verification edges and includes side-effect imports', () => {
  const cache = join(REPO_ROOT, '.cache');
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, 'package-graph-'));
  const files = {
    'apps/a/package.json': JSON.stringify({ name: '@apps/a', devDependencies: { '@libs/test': 'workspace:*' } }),
    'libs/test/package.json': '{"name":"@libs/test"}',
    'pkgs/time/package.json': '{"name":"@pkgs/time"}',
    'apps/a/src/boot.ts': "import '@pkgs/time/init'; export { type Clock } from '@libs/test/types';",
    'apps/a/src/boot.test.ts': "import '../../../libs/test/helper';",
  };
  try {
    for (const [path, text] of Object.entries(files)) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    execFileSync('git', ['init', '--quiet'], {cwd: root});
    execFileSync('git', ['add', '.'], {cwd: root});
    expect(packageEdges(root, 'src').get('@apps/a')).toEqual(['@pkgs/time']);
    expect(packageEdges(root, 'all').get('@apps/a')).toEqual(['@libs/test', '@pkgs/time']);
    expect(packageEdges(root, 'declared').get('@apps/a')).toEqual(['@libs/test']);
  } finally {
    removeTree(root, {whenLocked: 'leave'});
  }
});
