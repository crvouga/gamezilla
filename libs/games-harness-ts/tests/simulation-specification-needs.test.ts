import { expect, test } from 'bun:test';
import { specificationGames } from '@libs/games-harness-ts/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';

// regression: simulation-enrolled-in-turn-only-specifications
test.each([
  'game-turns',
  'matched-game-results',
  'matched-game-accessibility',
  'matched-game-daily-clock',
  'matched-game-result-notices',
])('the actual %s contract selects genuine turns or clock choices', (stem) => {
  expect(
    specificationGames(`specs/games/${stem}.feature`, HARNESS_GAMES).map(
      (game) => game.shared.id
    )
  ).toEqual(['chess', 'connect-four', 'battleship', 'quoridor']);
});

test.each([
  'custom-game-creation',
  'custom-game-invitations',
  'finding-an-opponent-without-a-clock',
  'matched-game-without-turns',
])('Pong remains enrolled in its actual %s obligations', (stem) => {
  expect(
    specificationGames(`specs/games/${stem}.feature`, HARNESS_GAMES).map(
      (game) => game.shared.id
    )
  ).toContain('pong');
});

// regression: simulation-enrolled-in-multi-seat-turn-specifications
test.each(['multi-seat-games', 'multi-seat-recovery', 'four-seat-matchmaking'])(
  'the turn-based %s contract never enrolls a multi-rider simulation',
  (stem) => {
    const ids = specificationGames(
      `specs/games/${stem}.feature`,
      HARNESS_GAMES
    ).map((game) => game.shared.id);
    expect(ids).toContain('quoridor-hill');
    expect(ids.filter((id) => id.startsWith('light-cycles'))).toEqual([]);
  }
);

// regression: clockless-games-enrolled-in-matched-game-ready-objective
test('the matched-game-ready objective holds only games with turns and clock choices', () => {
  const ids = specificationGames(
    'specs/games/matched-game-ready.openslo.yaml',
    HARNESS_GAMES
  ).map((game) => game.shared.id);
  expect(ids).toContain('chess');
  expect(ids).not.toContain('pong');
  expect(ids.filter((id) => id.startsWith('light-cycles'))).toEqual([]);
});
