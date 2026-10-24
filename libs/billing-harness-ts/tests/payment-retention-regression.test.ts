import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// regression: payment-retention-fixture-keeps-renewing
test('payment retention ages a deleted account without creating fresh subscription charges', () => {
  const result = spawnSync(
    'bun',
    [
      'run',
      '../../libs/harness-ts/scripts/test-spec.ts',
      'specs/billing/deleted-account-payments.feature',
      '-t',
      'Ordinary payment retention expires after seven years',
    ],
    { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('1 pass');
  expect(result.stderr).toContain('0 fail');
}, 60_000);
