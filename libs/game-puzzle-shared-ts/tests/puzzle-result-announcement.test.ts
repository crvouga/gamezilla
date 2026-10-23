import { describe, expect, test } from 'bun:test';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { puzzleResultAnnouncement } from '@libs/game-puzzle-shared-ts/puzzle-result-announcement';

const COMPLETION: PuzzleCompletion = {
  outcome: 'solved',
  ratingBefore: 1500,
  ratingAfter: 1508,
  delta: 8,
  streak: 1,
  puzzleRating: 1480,
  rated: true,
};

describe("what someone listening hears of a puzzle's results, in any game", () => {
  test('a wrong move is said in words', () => {
    expect(
      puzzleResultAnnouncement({ status: 'wrong', completion: null })
    ).toEqual([{ kind: 'wrong' }]);
  });

  test('a solve is heard with the rating change', () => {
    expect(
      puzzleResultAnnouncement({ status: 'solved', completion: COMPLETION })
    ).toEqual([
      { kind: 'solved' },
      { kind: 'ratingChange', delta: 8, ratingAfter: 1508 },
    ]);
  });

  test('a solve is heard before its rating change is known', () => {
    expect(
      puzzleResultAnnouncement({ status: 'solved', completion: null })
    ).toEqual([{ kind: 'solved' }]);
  });

  test('the shown solution and a skip are heard too', () => {
    expect(
      puzzleResultAnnouncement({ status: 'revealed', completion: null })
    ).toEqual([{ kind: 'revealed' }]);
    expect(
      puzzleResultAnnouncement({ status: 'skipped', completion: null })
    ).toEqual([{ kind: 'skipped' }]);
  });

  test('an unrated repeat is heard as unrated', () => {
    expect(
      puzzleResultAnnouncement({
        status: 'solved',
        completion: { ...COMPLETION, rated: false, delta: 0 },
      })
    ).toEqual([{ kind: 'solved' }, { kind: 'unrated' }]);
  });

  test('nothing is heard while solving or loading', () => {
    expect(
      puzzleResultAnnouncement({ status: 'solving', completion: null })
    ).toEqual([]);
    expect(
      puzzleResultAnnouncement({ status: 'loading', completion: null })
    ).toEqual([]);
  });
});
