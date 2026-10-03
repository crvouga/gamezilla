import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// regression: custom-game-journey-unbound
// regression: custom-game-confirm-unmounted
// regression: custom-game-journey-offline-race
test('the journey runner binds and completes both literal Custom Game scenarios', () => {
  const result = spawnSync(
    'bun',
    [
      'run',
      '../../libs/harness/scripts/test-spec.ts',
      'specs/journeys/custom-game.feature',
    ],
    { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('2 pass');
  expect(result.stderr).toContain('0 fail');
}, 20_000);
