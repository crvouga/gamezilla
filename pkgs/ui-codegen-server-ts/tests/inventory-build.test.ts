import { expect, test } from 'bun:test';
import { win32 } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { buildInventory } from '@pkgs/ui-codegen-server-ts/inventory-build';
import ts from 'typescript';

// regression: inventory-windows-absolute-paths
test('a Windows checkout lists repository-relative files in the inventory', () => {
  const repo = 'C:\\repo';
  const client = win32.join(repo, 'pkgs', 'ui-root-client-ts');
  const shared = win32.join(repo, 'pkgs', 'ui-root-shared-ts');
  const disk = new Map([
    ['C:/repo/pkgs/ui-root-client-ts/src/component-registry.ts', ''],
    ['C:/repo/pkgs/ui-root-client-ts/skin.css', '.a { z-index: 1; }'],
    ['C:/repo/pkgs/ui-root-shared-ts/src/design-tokens.json', '{}'],
  ]);
  const inventory = buildInventory(
    ts.createProgram({ rootNames: [], options: {} }),
    { list: () => [], read: (path) => disk.get(slashPath(path)) ?? null },
    {
      repo,
      clientSrc: win32.join(client, 'src'),
      storySources: [win32.join(repo, 'pkgs/ui-root-harness-ts/stories')],
      sharedSrc: win32.join(shared, 'src'),
      extraStylesheets: [win32.join(client, 'skin.css')],
      tokenDocument: win32.join(shared, 'src', 'design-tokens.json'),
      compiledTokens: win32.join(client, 'src', 'tokens.css'),
      commit: 'abc',
    }
  );
  expect(inventory.literals.map((literal) => literal.file)).toEqual([
    'pkgs/ui-root-client-ts/skin.css',
  ]);
  expect(inventory.styles.map((rule) => rule.file)).toEqual([
    'pkgs/ui-root-client-ts/skin.css',
  ]);
});
