import { expect, test } from 'bun:test';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { GAME_CAPABILITIES } from '@pkgs/turn-game-shared/game-rules';

test('every registered game is enrolled in the shared suites, in registry order', () => {
  expect(HARNESS_GAMES.map((game) => game.shared.id)).toEqual(
    GAME_DEFINITIONS.map((game) => game.id)
  );
});

test('each enrolled game is the very definition production registers', () => {
  for (const [index, game] of HARNESS_GAMES.entries())
    expect(game.shared).toBe(GAME_DEFINITIONS[index]!);
});

test('every enrolled game declares only known capabilities, once each', () => {
  for (const game of HARNESS_GAMES) {
    const declared = game.shared.turnGame.capabilities;
    expect(new Set(declared).size).toBe(declared.length);
    for (const capability of declared)
      expect(GAME_CAPABILITIES).toContain(capability);
  }
});

test('each enrolled game shows the very client production registers', async () => {
  const { GAME_CLIENT_DEFINITIONS } = await import(
    '@libs/games-client/game-plugins.client'
  );
  for (const [index, game] of HARNESS_GAMES.entries())
    expect(game.client).toBe(GAME_CLIENT_DEFINITIONS[index]!);
});
