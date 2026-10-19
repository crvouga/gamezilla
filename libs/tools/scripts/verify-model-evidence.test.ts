import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyModelEvidence } from './verify-model-evidence';

test('failed model transfer keeps verdicts and diagnostics while excluding private runtime data', () => {
  const root = mkdtempSync(join(tmpdir(), 'model-transfer-'));
  try {
    const source = join(root, 'source');
    const target = join(root, 'target');
    for (const name of [
      'evidence/whole.json',
      'whole.symbolic-bound.json',
      'whole/tlc-output.txt',
      'whole/example.itf.json',
      'whole/tmp/private.json',
      'whole/quint-home/tool.txt',
    ]) {
      const path = join(source, name);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, name);
    }
    copyModelEvidence(source, target);
    for (const name of [
      'evidence/whole.json',
      'whole.symbolic-bound.json',
      'whole/tlc-output.txt',
      'whole/example.itf.json',
    ])
      expect(existsSync(join(target, name))).toBe(true);
    expect(existsSync(join(target, 'whole/tmp'))).toBe(false);
    expect(existsSync(join(target, 'whole/quint-home'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
