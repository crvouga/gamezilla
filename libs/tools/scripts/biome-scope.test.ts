import { describe, expect, test } from 'bun:test';

import {
  dependencyClosure,
  scopedBiomeConfig,
  workspaceDeps,
} from './biome-scope';

const packages = new Map([
  ['@pkgs/a', { dir: 'pkgs/a', deps: ['@pkgs/b'] }],
  ['@pkgs/b', { dir: 'pkgs/b', deps: ['@pkgs/c', '@pkgs/a'] }],
  ['@pkgs/c', { dir: 'pkgs/c', deps: [] }],
  ['@libs/d', { dir: 'libs/d', deps: ['@pkgs/a'] }],
]);

describe('dependencyClosure', () => {
  test('follows declared deps transitively, through cycles', () => {
    expect([...dependencyClosure(packages, 'pkgs/a')].sort()).toEqual([
      'pkgs/a',
      'pkgs/b',
      'pkgs/c',
    ]);
  });

  test('a leaf keeps only itself', () => {
    expect([...dependencyClosure(packages, 'pkgs/c')]).toEqual(['pkgs/c']);
  });
});

describe('scopedBiomeConfig', () => {
  test('force-ignores every package outside the closure, keeping the rest', () => {
    const root = { root: true, files: { includes: ['**', '!!**/dist'] } };
    const config = scopedBiomeConfig(
      root,
      ['pkgs/c', 'libs/d', 'pkgs/a'],
      new Set(['pkgs/a'])
    );
    expect(config).toEqual({
      root: true,
      files: { includes: ['**', '!!**/dist', '!!libs/d', '!!pkgs/c'] },
    });
  });
});

describe('workspaceDeps', () => {
  test('keeps workspace: versions from both dependency maps', () => {
    expect(
      workspaceDeps({
        dependencies: { '@pkgs/a': 'workspace:*', zod: 'catalog:' },
        devDependencies: { '@pkgs/b': 'workspace:^' },
      })
    ).toEqual(['@pkgs/a', '@pkgs/b']);
  });
});
