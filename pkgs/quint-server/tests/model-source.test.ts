import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelSourceKey } from '@pkgs/quint-server/model-source';

// regression: quint-draw-cache-ignores-imported-model
test('draw identity includes imported models but excludes unrelated files and checkout paths', () => {
  const roots = [
    mkdtempSync(join(tmpdir(), 'quint-key-')),
    mkdtempSync(join(tmpdir(), 'quint-key-')),
  ];
  try {
    for (const root of roots) {
      writeFileSync(
        join(root, 'events.qnt'),
        'module events { val limit = 1 }'
      );
      writeFileSync(
        join(root, 'model.qnt'),
        'module model { import events.* from "./events" }'
      );
    }
    const path = join(roots[0]!, 'model.qnt');
    const before = modelSourceKey(path);
    expect(modelSourceKey(join(roots[1]!, 'model.qnt'))).toBe(before);
    writeFileSync(join(roots[0]!, 'unrelated.qnt'), 'module unrelated {}');
    expect(modelSourceKey(path)).toBe(before);
    writeFileSync(
      join(roots[0]!, 'events.qnt'),
      'module events { val limit = 2 }'
    );
    expect(modelSourceKey(path)).not.toBe(before);
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
