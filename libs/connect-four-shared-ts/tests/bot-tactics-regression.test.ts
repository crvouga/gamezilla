import { expect, test } from 'bun:test';
import {
  dropDisc,
  newConnectFour,
} from '@libs/connect-four-shared-ts/connect-four';
import { chooseConnectFourColumn } from '@libs/connect-four-shared-ts/connect-four-bot';

// regression: connect-four-bot-misses-immediate-defense
test.each(['medium', 'hard'] as const)(
  '%s blocks the vertical threat after the reduced nightly sequence',
  (difficulty) => {
    let game = newConnectFour();
    for (const column of [4, 6, 0, 6, 2, 3, 4, 6]) {
      const next = dropDisc(game, column);
      expect(next).not.toBeNull();
      game = next!;
    }
    const before = JSON.stringify(game);
    expect(chooseConnectFourColumn(game, difficulty, () => 0)).toBe(6);
    expect(JSON.stringify(game)).toBe(before);
  }
);
