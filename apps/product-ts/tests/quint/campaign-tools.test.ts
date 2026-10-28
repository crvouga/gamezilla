import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { CLI_TIMEOUT_MS } from './campaign-config';
import { sample } from './campaign-tools';
import { withSymbolicInput } from './symbolic-input';

// regression: verify-symbolic-report-directory
// regression: symbolic-input-transforms-unrelated-models
test('identity symbolic compilation creates its absent report directory', async () => {
  const root = mkdtempSync(join(tmpdir(), 'product-symbolic-report-'));
  const reportDir = join(root, 'absent/models');
  try {
    expect(existsSync(reportDir)).toBe(false);
    await withSymbolicInput(
      'identity-machine',
      async (_path, bound) => {
        expect(bound).toContain('Original actor/client bounds.');
        expect(
          existsSync(join(reportDir, 'identity-machine.symbolic-bound.json'))
        ).toBe(true);
      },
      reportDir
    );
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: product-model-trace-directory-missing
test(
  'identity exploration writes its trace on a fresh report directory',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'product-model-trace-'));
    const reportDir = join(root, 'harness-report/models');
    try {
      expect(existsSync(reportDir)).toBe(false);
      expect(await sample('identity-machine', 200, 80, reportDir)).toContain(
        '[ok]'
      );
      expect(
        existsSync(join(reportDir, 'identity-machine-last.itf.json'))
      ).toBe(true);
    } finally {
      removeTree(root, { whenLocked: 'leave' });
    }
  },
  CLI_TIMEOUT_MS
);
