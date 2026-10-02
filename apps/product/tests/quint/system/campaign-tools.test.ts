import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_TIMEOUT_MS } from './campaign-config';
import { sample } from './campaign-tools';

// regression: product-model-trace-directory-missing
test(
  'identity exploration writes its trace on a fresh report directory',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'product-model-trace-'));
    const reportDir = join(root, 'harness-report/models');
    try {
      expect(existsSync(reportDir)).toBe(false);
      expect(sample('identity-machine', 200, 80, reportDir)).toContain('[ok]');
      expect(
        existsSync(join(reportDir, 'identity-machine-last.itf.json'))
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  CLI_TIMEOUT_MS
);
