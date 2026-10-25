import { expect, test } from 'bun:test';
import { isGameRegistration } from '@libs/game-session-shared-ts/game-definition';
import {
  GAME_DEFINITIONS,
  PLAYABLE_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';

test('the product registers Numberlink and Sokoban with puzzle capabilities and no turn engine', () => {
  for (const id of ['numberlink', 'sokoban']) {
    const game = GAME_DEFINITIONS.find((entry) => entry.id === id);
    expect(game).toBeDefined();
    expect(game?.puzzleContent).toBeDefined();
    expect(game?.registration).toBeUndefined();
    expect(game?.turnGame).toBeUndefined();
    expect(isGameRegistration(game)).toBe(false);
  }
  expect(PLAYABLE_GAME_DEFINITIONS.map((game) => game.id)).toEqual(
    GAME_DEFINITIONS.filter(isGameRegistration).map((game) => game.id)
  );
  expect(PLAYABLE_GAME_DEFINITIONS.map((game) => game.id)).toEqual([
    'chess',
    'connect-four',
    'battleship',
    'quoridor',
    'quoridor-hill',
    'word-tiles',
    'word-tiles-3',
    'word-tiles-4',
    'hearts',
    'pong',
    'light-cycles',
    'light-cycles-3',
    'light-cycles-4',
  ]);
});
