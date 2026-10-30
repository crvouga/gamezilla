import { expect, test } from 'bun:test';
import { isProductionSource } from './production-source';
import {
  type SrcPackage,
  srcDependsOn,
  srcEdgeDrift,
  withSrcDependsOn,
} from './src-task-edges';

const WORKSPACE = new Set(['@pkgs/a', '@pkgs/b', '@pkgs/c', '@pkgs/helper']);

function pkg(overrides: Partial<SrcPackage>): SrcPackage {
  return {
    name: '@pkgs/consumer',
    dir: 'pkgs/consumer',
    declared: new Set(),
    imported: new Set(),
    ...overrides,
  };
}

test('a package whose visible files name every declared workspace package keeps the root edges', () => {
  expect(
    srcDependsOn(
      pkg({
        declared: new Set(['@pkgs/a', '@pkgs/b', '@types/bun']),
        imported: new Set(['@pkgs/a', '@pkgs/b']),
      }),
      WORKSPACE
    )
  ).toBeUndefined();
});

test('a workspace package only tests and scripts use, or that nothing uses, is not an edge of src', () => {
  expect(
    srcDependsOn(
      pkg({
        declared: new Set(['@pkgs/b', '@pkgs/a', '@pkgs/helper', 'solid-js']),
        imported: new Set(['@pkgs/a', '@pkgs/b']),
      }),
      WORKSPACE
    )
  ).toEqual(['@pkgs/a#src', '@pkgs/b#src']);
});

test('a package that names no declared workspace package lists none', () => {
  expect(
    srcDependsOn(pkg({ declared: new Set(['@pkgs/helper']) }), WORKSPACE)
  ).toEqual([]);
});

test('the edges are written into a new or an existing turbo.json and removed again', () => {
  const written = withSrcDependsOn(undefined, ['@pkgs/a#src']);
  expect(written).toEqual({
    $schema: 'https://v2-11-3.turborepo.dev/schema.json',
    extends: ['//'],
    tasks: { src: { dependsOn: ['@pkgs/a#src'] } },
  });
  expect(withSrcDependsOn(written, undefined)).toBeUndefined();
  const withInputs = {
    extends: ['//'],
    tasks: {
      test: { inputs: ['$TURBO_DEFAULT$'] },
      src: { inputs: ['!x'], dependsOn: ['@pkgs/a#src'] },
    },
  };
  expect(withSrcDependsOn(withInputs, undefined)).toEqual({
    extends: ['//'],
    tasks: {
      test: { inputs: ['$TURBO_DEFAULT$'] },
      src: { inputs: ['!x'] },
    },
  });
});

test('every package lists the src edges its dependencies call for', () => {
  const drift = srcEdgeDrift();
  expect(
    drift,
    'run `bun run libs/tools-harness-ts/scripts/src-task-edges.ts`'
  ).toEqual([]);
});

test('colocated previews do not enter the production source hash', () => {
  for (const file of ['src/button/button.tsx', 'src/button/button.module.css'])
    expect(isProductionSource(file)).toBe(true);
  for (const file of [
    'src/button/button.stories.tsx',
    'src/button/button.example.tsx',
    'src/button/baselines/chromium/default.png',
    'storybook/fixtures/frame.tsx',
  ])
    expect(isProductionSource(`pkgs/ui-root-client-ts/${file}`)).toBe(false);
});
