import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

test('the public render entrypoint resolves without workspace aliases or a warm module cache', () => {
  // regression: isolated-solid-self-export
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'solid-cold-export-')));
  try {
    writeFileSync(
      join(root, 'package.json'),
      readFileSync(new URL('../package.json', import.meta.url))
    );
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'tests'));
    writeFileSync(join(root, 'src/render.tsx'), 'export {};');
    expect(
      Bun.resolveSync(
        '@pkgs/bun-test-solid-client-ts/render',
        join(root, 'tests')
      )
    ).toBe(join(root, 'src/render.tsx'));
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
