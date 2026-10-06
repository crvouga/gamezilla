import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preserveInterruptedModels } from './check-interrupted-models';

// regression: interrupted-model-proof-evidence-lost
test('a killed chess task retains completed TLC verdicts from private scratch', () => {
  const root = mkdtempSync(join(tmpdir(), 'interrupted-model-'));
  try {
    const scratch = join(root, 'package/.cache/model-check-chess');
    mkdirSync(join(scratch, 'tlc'), { recursive: true });
    const verdict = 'TLC explored 42 states, then timed out';
    writeFileSync(join(scratch, 'tlc/tlc-output.txt'), verdict);
    writeFileSync(join(scratch, 'tlc/private.json'), 'private runtime data');
    const target = join(root, 'evidence');
    preserveInterruptedModels(join(root, 'package'), target);
    expect(
      readFileSync(
        join(target, 'interrupted/model-check-chess/tlc/tlc-output.txt'),
        'utf8'
      )
    ).toBe(verdict);
    expect(
      existsSync(join(target, 'interrupted/model-check-chess/tlc/private.json'))
    ).toBe(false);
    expect(() =>
      preserveInterruptedModels(join(root, 'missing'), target)
    ).not.toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
