import { expect, test } from 'bun:test';
import { basename, dirname } from 'node:path';
import { createWorkspaceResolver } from '@pkgs/bun-test-solid-client-ts/register';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('workspace resolution preserves native missing-export errors and remains usable afterward', () => {
  const resolve = createWorkspaceResolver((specifier, directory) =>
    Bun.resolveSync(specifier, directory)
  );
  expect(() =>
    resolve({
      path: '@pkgs/bun-test-solid-client-ts/no-such-export',
      importer: import.meta.filename,
    })
  ).toThrow();
  const resolved = resolve({
    path: '@pkgs/bun-test-solid-client-ts/render',
    importer: import.meta.filename,
  });
  expect(resolved).toBeDefined();
  expect(basename(resolved?.path ?? '')).toBe('render.tsx');
  expect(basename(dirname(resolved?.path ?? ''))).toBe('src');
});

test('native and third-party imports are left to Bun without workspace interception', () => {
  const resolve = createWorkspaceResolver(() => {
    throw new Error('must not intercept');
  });
  for (const path of [
    'bun:test',
    'node:fs',
    'solid-js',
    '@lingui/core',
    './view.tsx',
  ]) {
    expect(
      resolve({ path, importer: '/workspace/example.tsx' })
    ).toBeUndefined();
  }
});

test('generated workspace imports resolve once through their importing directory despite native reentry', async () => {
  await assertProperty(
    'workspace resolver delegates without recursive alias resolution',
    fc.property(
      fc.constantFrom('libs', 'pkgs'),
      fc.stringMatching(/^[a-z]{1,12}$/),
      (scope, name) => {
        const path = `@${scope}/${name}/view`;
        const importer = `/workspace/${scope}/${name}/src/example.tsx`;
        const calls: string[][] = [];
        const resolve = createWorkspaceResolver((specifier, directory) => {
          calls.push([specifier, directory]);
          expect(resolve({ path: specifier, importer })).toBeUndefined();
          return `/native/${name}/view.tsx`;
        });
        expect(resolve({ path, importer })).toEqual({
          path: `/native/${name}/view.tsx`,
        });
        expect(calls).toEqual([[path, `/workspace/${scope}/${name}/src`]]);
      }
    )
  );
});
