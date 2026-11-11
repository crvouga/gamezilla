import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import {
  danglingExtends,
  readTurboTasks,
  resolvePackageTask,
} from './turbo-config';

function workspace(
  root: object,
  packages: Record<string, object | undefined>
): string {
  const dir = mkdtempSync(join(tmpdir(), 'turbo-config-'));
  writeFileSync(join(dir, 'turbo.json'), JSON.stringify(root));
  for (const [name, turbo] of Object.entries(packages)) {
    const pkg = join(dir, 'libs', name);
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: `@libs/${name}` })
    );
    if (turbo !== undefined)
      writeFileSync(join(pkg, 'turbo.json'), JSON.stringify(turbo));
  }
  return dir;
}

test('a package field replaces the inherited one unless it lists $TURBO_EXTENDS$', () => {
  expect(
    resolvePackageTask(
      { dependsOn: ['^src'], inputs: ['a'], outputs: ['dist/**'] },
      { inputs: ['$TURBO_EXTENDS$', 'b'], outputs: [], cache: false }
    )
  ).toEqual({
    dependsOn: ['^src'],
    inputs: ['a', 'b'],
    outputs: [],
    cache: false,
  });
  expect(resolvePackageTask(undefined, { inputs: ['b'] })).toEqual({
    inputs: ['b'],
  });
});

test('the merged view holds root tasks as written and package tasks resolved', () => {
  const dir = workspace(
    {
      tasks: {
        test: { inputs: ['src/**'], outputs: [] },
        '//#task:x': { cache: false },
      },
    },
    {
      a: {
        extends: ['//'],
        tasks: {
          test: { inputs: ['$TURBO_EXTENDS$', 'fixtures/**'] },
          deploy: { cache: false, dependsOn: ['test'] },
        },
      },
      b: undefined,
    }
  );
  try {
    expect(readTurboTasks(dir)).toEqual({
      test: { inputs: ['src/**'], outputs: [] },
      '//#task:x': { cache: false },
      '@libs/a#test': { inputs: ['src/**', 'fixtures/**'], outputs: [] },
      '@libs/a#deploy': { cache: false, dependsOn: ['test'] },
    });
  } finally {
    removeTree(dir);
  }
});

test('a package task that extends a field nobody defines is reported', () => {
  const dir = workspace(
    { tasks: { test: { inputs: ['src/**'] } } },
    {
      a: {
        tasks: {
          test: { inputs: ['$TURBO_EXTENDS$'], outputs: ['$TURBO_EXTENDS$'] },
          'verify:models:1:0': { inputs: ['$TURBO_EXTENDS$', 'x.qnt'] },
        },
      },
    }
  );
  try {
    expect(danglingExtends(dir)).toEqual([
      'libs/a/turbo.json: test.outputs extends nothing — no root "test" defines outputs; declare the whole definition here',
      'libs/a/turbo.json: verify:models:1:0.inputs extends nothing — no root "verify:models:1:0" defines inputs; declare the whole definition here',
    ]);
  } finally {
    removeTree(dir);
  }
});

// regression: model-phase-tasks-extend-nothing
test('no package task in this repository extends a definition that does not exist', () => {
  expect(danglingExtends()).toEqual([]);
});
