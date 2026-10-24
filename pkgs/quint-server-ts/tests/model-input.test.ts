import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
    rmSync(dir, { recursive: true, force: true });
  }
});
