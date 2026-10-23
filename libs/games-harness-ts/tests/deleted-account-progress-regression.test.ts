import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('a revoked session cannot retain puzzle progress on another device', () => {
  // regression: sync-boot-reuses-revoked-session
  const result = spawnSync(
    'bun',
    [
      'run',
      '../../libs/harness-ts/scripts/test-spec.ts',
      'specs/games/deleted-account-progress.feature',
      '-t',
      "Account deletion erases puzzle progress on the person's other device",
    ],
    { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('3 pass');
  expect(result.stderr).toContain('0 fail');
}, 60_000);
