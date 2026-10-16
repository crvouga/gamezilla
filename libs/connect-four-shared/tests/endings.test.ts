import { expect, test } from 'bun:test';
import {
  dropDisc,
  newConnectFour,
  replayConnectFour,
} from '@libs/connect-four-shared/connect-four';
import { chooseConnectFourColumn } from '@libs/connect-four-shared/connect-four-bot';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';

test.each([0, 1, 2, 3, 4, 5, 6])(
  'the first disc reaches the floor in column %s',
  (column) => {
    const game = dropDisc(newConnectFour(), column)!;
    expect(game.board[column]).toBe(1);
    expect(game.board.filter(Boolean)).toHaveLength(1);
  }
);
test('the forty-second disc wins before a full board can become a draw', () => {
  const moves = [
    6, 1, 3, 3, 4, 2, 1, 0, 2, 1, 2, 2, 6, 4, 4, 1, 3, 3, 1, 1, 6, 5, 4, 2, 4,
    2, 3, 5, 0, 3, 0, 5, 5, 6, 0, 0, 0, 6, 6, 5, 5, 4,
  ];
  expect(replayConnectFour(moves.slice(0, 41)).result).toBe(0);
  const final = replayConnectFour(moves);
  expect(final.result).toBe(2);
  expect(final.winning.length).toBeGreaterThanOrEqual(4);
  expect(final.board.every(Boolean)).toBe(true);
  expect(dropDisc(final, 4)).toBeNull();
});
test('one drop highlights both intersecting winning lines and ends once', () => {
  const moves = [
    6, 1, 5, 6, 4, 0, 5, 1, 2, 0, 6, 5, 2, 3, 0, 5, 6, 5, 1, 6, 2, 0, 6, 4, 4,
    0, 0, 3, 4, 3, 5, 4, 4, 1, 1, 2, 2, 2, 1, 3,
  ];
  expect(replayConnectFour(moves.slice(0, -1)).result).toBe(0);
  const game = replayConnectFour(moves);
  expect(game.result).toBe(2);
  expect(game.winning.length).toBeGreaterThanOrEqual(7);
});
test('an inserted disc connects five while gaps and edge wrapping cannot win', () => {
  const game = replayConnectFour([0, 6, 1, 6, 3, 5, 4, 5, 2]);
  expect(game.result).toBe(1);
  expect(game.winning).toEqual([0, 1, 2, 3, 4]);
  expect(replayConnectFour([4, 0, 5, 1, 6, 2, 0]).result).toBe(0);
  expect(replayConnectFour([0, 6, 1, 6, 3]).result).toBe(0);
});
test('planning beats legal random play over reproducible games on either side', () => {
  let won = 0;
  let lost = 0;
  for (let seed = 0; seed < 8; seed++)
    for (const side of [1, 2]) {
      const random = createSeededRng(`connect-four-strength-${seed}`).random;
      let game = newConnectFour();
      while (game.result === 0)
        game = dropDisc(
          game,
          chooseConnectFourColumn(
            game,
            game.turn === side ? 'hard' : 'easy',
            random
          )!
        )!;
      if (game.result === side) won++;
      else if (game.result !== 3) lost++;
    }
  expect(won).toBeGreaterThan(lost);
  expect(won).toBeGreaterThanOrEqual(12);
});
