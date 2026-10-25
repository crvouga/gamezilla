import { expect, test } from 'bun:test';
import { isTurnGameDefinition } from '@libs/game-session-shared-ts/turn-game-definition';
import {
  GAME_DEFINITIONS,
  TURN_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';

test('the product registers Numberlink and Sokoban with puzzle capabilities and no turn engine', () => {
  for (const id of ['numberlink', 'sokoban']) {
    const game = GAME_DEFINITIONS.find((entry) => entry.id === id);
    expect(game).toBeDefined();
    expect(game?.puzzleContent).toBeDefined();
    expect(game?.turnGame).toBeUndefined();
    expect(isTurnGameDefinition(game)).toBe(false);
  }
  expect(TURN_GAME_DEFINITIONS.map((game) => game.id)).toEqual(
    GAME_DEFINITIONS.filter(isTurnGameDefinition).map((game) => game.id)
  );
  expect(TURN_GAME_DEFINITIONS.map((game) => game.id)).toEqual([
    'chess',
    'connect-four',
    'battleship',
    'quoridor',
    'quoridor-hill',
  ]);
});
