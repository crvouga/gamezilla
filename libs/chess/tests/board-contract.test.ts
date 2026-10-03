import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// regression: chess-custom-board-sound-preference
test('Custom Game and puzzle boards satisfy the public board and sound contracts', () => {
  const result = spawnSync('bun', ['run', 'scripts/check-board-contract.ts'], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
