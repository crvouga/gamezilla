import { describe, expect, test } from 'bun:test';
import type { PuzzleCompletion } from '@libs/chess-puzzle-shared/completion';
import type { PuzzleAnnouncementInput } from '@libs/chess-puzzle-shared/puzzle-announcement';
import { puzzleAnnouncement } from '@libs/chess-puzzle-shared/puzzle-announcement';

const MOVES = 'a7a6 a1a5 h7h6 h1h5';
const START_FEN = '6k1/1p3ppp/p7/8/8/8/5PPP/R5KR w - - 0 1';

function input(
  over: Partial<PuzzleAnnouncementInput>
): PuzzleAnnouncementInput {
  return {
    status: 'solving',
    moves: MOVES,
    solveIdx: 1,
    solverSide: 'white',
    hintStage: 'none',
    fen: START_FEN,
    hintSquare: null,
    completion: null,
    ...over,
  };
}

const COMPLETION: PuzzleCompletion = {
  outcome: 'solved',
  ratingBefore: 1500,
  ratingAfter: 1508,
  delta: 8,
  streak: 1,
  puzzleRating: 1480,
  rated: true,
};

describe('what someone listening hears about a puzzle', () => {
  test('opening: the setup move, then whose move it is', () => {
    expect(puzzleAnnouncement(input({}))).toEqual([
      {
        kind: 'opponentMove',
        setup: true,
        side: 'black',
        from: 'a7',
        to: 'a6',
      },
      { kind: 'toMove', side: 'white' },
    ]);
  });

  test("the opponent's reply, then the solver to move again", () => {
    expect(puzzleAnnouncement(input({ solveIdx: 3 }))).toEqual([
      {
        kind: 'opponentMove',
        setup: false,
        side: 'black',
        from: 'h7',
        to: 'h6',
      },
      { kind: 'toMove', side: 'white' },
    ]);
  });

  test("the solver's own move while the reply is coming", () => {
    expect(puzzleAnnouncement(input({ solveIdx: 2 }))).toEqual([
      { kind: 'solverMove', side: 'white', from: 'a1', to: 'a5' },
    ]);
  });

  test('a wrong move is said in words', () => {
    expect(puzzleAnnouncement(input({ status: 'wrong' }))).toEqual([
      { kind: 'wrong' },
    ]);
  });

  test('a hint names the piece it picks and its square', () => {
    expect(
      puzzleAnnouncement(input({ hintStage: 'highlight', hintSquare: 'a1' }))
    ).toContainEqual({ kind: 'hint', side: 'white', piece: 'r', square: 'a1' });
  });

  test('a solve is heard with the rating change', () => {
    expect(
      puzzleAnnouncement(input({ status: 'solved', completion: COMPLETION }))
    ).toEqual([
      { kind: 'solved' },
      { kind: 'ratingChange', delta: 8, ratingAfter: 1508 },
    ]);
  });

  test('an unrated repeat is heard as unrated', () => {
    expect(
      puzzleAnnouncement(
        input({
          status: 'solved',
          completion: { ...COMPLETION, rated: false, delta: 0 },
        })
      )
    ).toEqual([{ kind: 'solved' }, { kind: 'unrated' }]);
  });

  test('nothing is heard while the puzzle loads', () => {
    expect(puzzleAnnouncement(input({ status: 'loading' }))).toEqual([]);
  });
});
