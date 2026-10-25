import { expect, test } from 'bun:test';
import { isGameRegistration } from '@libs/game-session-shared-ts/game-definition';
import {
  GAME_DEFINITIONS,
  PLAYABLE_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';

test('the product registers Numberlink with puzzle capabilities and no turn engine', () => {
  const numberlink = GAME_DEFINITIONS.find((game) => game.id === 'numberlink');
  expect(numberlink).toBeDefined();
  expect(numberlink?.puzzleContent).toBeDefined();
  expect(numberlink?.turnGame).toBeUndefined();
  expect(isGameRegistration(numberlink)).toBe(false);
  expect(PLAYABLE_GAME_DEFINITIONS.map((game) => game.id)).toEqual(
    GAME_DEFINITIONS.filter(isGameRegistration).map((game) => game.id)
  );
  expect(PLAYABLE_GAME_DEFINITIONS.map((game) => game.id)).toEqual([
    'chess',
    'connect-four',
    'battleship',
    'quoridor',
    'quoridor-hill',
    'pong',
    'light-cycles',
    'light-cycles-3',
    'light-cycles-4',
  ]);
});
