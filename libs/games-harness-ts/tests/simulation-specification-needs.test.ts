import { expect, test } from 'bun:test';
import { specificationGames } from '@libs/games-harness-ts/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';

// regression: simulation-enrolled-in-turn-only-specifications
const TURN_GAMES = [
  'chess',
  'connect-four',
  'battleship',
  'quoridor',
  'word-tiles',
];

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
  ).toEqual(TURN_GAMES);
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
