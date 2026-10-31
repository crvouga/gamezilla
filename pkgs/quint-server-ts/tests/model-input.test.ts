import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, win32 } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { rootlessPath } from '@pkgs/quint-server-ts/copy-model-input';
import { instantiatedModelInput } from '@pkgs/quint-server-ts/model-input';

test('a closed input retains transitive imports and ignores quoted examples', () => {
  const dir = mkdtempSync(join(tmpdir(), 'quint-model-input-'));
  try {
    writeFileSync(join(dir, 'leaf.qnt'), 'module leaf { val answer = 42 }');
    const dependency = 'module dependency { import leaf.* from "./leaf" }';
    writeFileSync(join(dir, 'dependency.qnt'), dependency);
    const source = `module example {
      // import absent.* from "./missing"
      const FLAG: bool
      import dependency.*
        from "./dependency.qnt"
      val text = "import ignored.* from ./missing"
    }`;
    const path = join(dir, 'example.qnt');
    writeFileSync(path, source);
    const copied = instantiatedModelInput(path, join(dir, 'output'), {
      FLAG: false,
    });
    expect(readFileSync(copied, 'utf8')).toBe(
      source.replace('const FLAG: bool', 'pure val FLAG: bool = false')
    );
    expect(readFileSync(join(dirname(copied), 'dependency.qnt'), 'utf8')).toBe(
      dependency
    );
    expect(readFileSync(join(dirname(copied), 'leaf.qnt'), 'utf8')).toBe(
      'module leaf { val answer = 42 }'
    );
    expect(readFileSync(path, 'utf8')).toBe(source);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});

// regression: quint-instantiated-source-windows-drive
test('an absolute source path nests under the copy root on every OS', () => {
  // The fixture directory a Windows runner nested (Verify run 40596596039).
  const windows =
    'C:\\actions-runner-2\\_work\\acme\\acme\\pkgs\\quint-server-ts\\tests\\fixtures';
  expect(rootlessPath(windows)).toBe(
    'actions-runner-2\\_work\\acme\\acme\\pkgs\\quint-server-ts\\tests\\fixtures'
  );
  expect(rootlessPath('\\\\server\\share\\m.qnt')).toBe('server\\share\\m.qnt');
  expect(rootlessPath('/repo/specs/m.qnt')).toBe('repo/specs/m.qnt');
  for (const path of [windows, '/repo/specs/m.qnt']) {
    const nested = rootlessPath(path);
    expect(win32.isAbsolute(nested)).toBe(false);
    expect(posix.isAbsolute(nested)).toBe(false);
    expect(nested).not.toContain(':');
  }
});
