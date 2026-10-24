import { expect, test } from 'bun:test';
import { isTurnGameDefinition } from '@libs/game-session-shared-ts/turn-game-definition';
import {
  GAME_DEFINITIONS,
  TURN_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';

test('the product registers Numberlink with puzzle capabilities and no turn engine', () => {
  const numberlink = GAME_DEFINITIONS.find((game) => game.id === 'numberlink');
  expect(numberlink).toBeDefined();
  expect(numberlink?.puzzleContent).toBeDefined();
  expect(numberlink?.turnGame).toBeUndefined();
  expect(isTurnGameDefinition(numberlink)).toBe(false);
  expect(TURN_GAME_DEFINITIONS.map((game) => game.id)).toEqual(
    GAME_DEFINITIONS.filter(isTurnGameDefinition).map((game) => game.id)
  );
  expect(TURN_GAME_DEFINITIONS.map((game) => game.id)).toEqual([
    'chess',
    'connect-four',
    'battleship',
  ]);
});
