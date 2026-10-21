import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// regression: multiplayer-journey-unbound
// regression: chess-match-room-initial-delivery
test('the journey runner binds and completes all three literal multiplayer journeys', () => {
  const result = spawnSync(
    'bun',
    [
      'run',
      '../../libs/harness-ts/scripts/test-spec.ts',
      'specs/journeys/multiplayer-game.feature',
    ],
    { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toContain('3 pass');
  expect(result.stderr).toContain('0 fail');
  // Nested `bun test` of the three journeys. A 20s cap killed the child on
  // the CI runner before it could exit, so a slow pass and a hung step
  // both arrived as a null status.
}, 60_000);
