import { expect, test } from 'bun:test';
import { customGameRefusal } from '@libs/game-session-shared-ts/custom-game-refusal';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';

const room = {
  members: ['alice', 'bob'],
  restricted: () => false,
  awaySince: () => null,
  now: 0,
};

test.each([
  ['active', 'already started'],
  ['completed', 'finished'],
  ['cancelled', 'cancelled'],
] as const)(
  'starting a %s custom game again is refused: %s',
  (status, reason) => {
    // regression: custom-game-start-again-silently-accepted
    const game: CustomGame = {
      ...newCustomGame('game', 'alice', 'position'),
      status,
    };
    expect(
      customGameRefusal(
        game,
        {
          operation: 'start',
          gameId: game.id,
          revision: game.revision,
        },
        'alice',
        room
      )
    ).toBe(reason);
  }
);
