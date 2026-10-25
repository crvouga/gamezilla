import { expect, test } from 'bun:test';
import { initialHarnessPosition } from '@libs/game-session-harness-ts/simulation-fixtures';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import opening from './fixtures/seeded-simulation-opening.json';

// regression: simulation-starting-position-uses-unseeded-fixture
test('the actual seeded opening is checked without requiring the default serve direction', () => {
  const game = HARNESS_GAMES.find((entry) => entry.shared.id === 'pong')!;
  expect(initialHarnessPosition(game.shared, opening.id)).toBe(
    opening.position
  );
  expect(game.shared.registration.rules.initial()).not.toBe(opening.position);
});
