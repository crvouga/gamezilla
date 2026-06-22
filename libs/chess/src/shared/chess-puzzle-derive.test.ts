import { describe, expect, test } from 'bun:test';

import { CHESS_PUZZLE_INTERACTION_KIND } from './chess-puzzle-interaction-entities';
import type { ChessPuzzleInteractionRow } from './chess-puzzle-interaction-entities';
import {
  deriveCurrentPlayCounts,
  deriveCurrentStreak,
  deriveOutcomeScore,
  deriveRecentlyAttemptedPuzzleIds,
  sliceCurrentPlay,
} from './chess-puzzle-derive';

function row(
  partial: Partial<ChessPuzzleInteractionRow> &
    Pick<ChessPuzzleInteractionRow, 'kind' | 'puzzleId' | 'at'>
): ChessPuzzleInteractionRow {
  return {
    puzzleId: partial.puzzleId,
    kind: partial.kind,
    solveIdx: partial.solveIdx ?? 0,
    uci: partial.uci ?? null,
    correct: partial.correct ?? null,
    puzzleRating: partial.puzzleRating ?? 1200,
    ratingBefore: partial.ratingBefore ?? 0,
    ratingAfter: partial.ratingAfter ?? 0,
    at: partial.at,
  };
}

describe('chess-puzzle-derive', () => {
  test('sliceCurrentPlay only includes rows after last started', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.moved,
        correct: true,
        at: '2',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '3',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.usedHint,
        at: '4',
      }),
    ];
    const play = sliceCurrentPlay(interactions, 'p1');
    expect(play).toHaveLength(2);
    expect(play[0]?.kind).toBe(CHESS_PUZZLE_INTERACTION_KIND.started);
    expect(play[1]?.kind).toBe(CHESS_PUZZLE_INTERACTION_KIND.usedHint);
  });

  test('deriveCurrentPlayCounts counts hints and wrong moves in current play', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.moved,
        correct: false,
        at: '2',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.usedHint,
        at: '3',
      }),
    ];
    expect(deriveCurrentPlayCounts(interactions, 'p1')).toEqual({
      hintsUsed: 1,
      wrongMoves: 1,
    });
  });

  test('deriveOutcomeScore: clean solve = 1', () => {
    const closed: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.moved,
        correct: true,
        at: '2',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '3',
      }),
    ];
    expect(deriveOutcomeScore(closed)).toBe(1);
  });

  test('deriveOutcomeScore: hint before solve = 0.5', () => {
    const closed: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.usedHint,
        at: '2',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '3',
      }),
    ];
    expect(deriveOutcomeScore(closed)).toBe(0.5);
  });

  test('deriveOutcomeScore: abandoned = 0', () => {
    const closed: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.abandoned,
        at: '2',
      }),
    ];
    expect(deriveOutcomeScore(closed)).toBe(0);
  });

  test('deriveRecentlyAttemptedPuzzleIds dedupes and caps', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'a',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '3',
      }),
      row({
        puzzleId: 'b',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '2',
      }),
      row({
        puzzleId: 'a',
        kind: CHESS_PUZZLE_INTERACTION_KIND.started,
        at: '1',
      }),
    ];
    expect(deriveRecentlyAttemptedPuzzleIds(interactions, 10)).toEqual([
      'a',
      'b',
    ]);
    expect(deriveRecentlyAttemptedPuzzleIds(interactions, 1)).toEqual(['a']);
  });

  test('deriveCurrentStreak counts consecutive solves', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      row({
        puzzleId: 'p1',
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '4',
      }),
      row({
        puzzleId: 'p2',
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '3',
      }),
      row({
        puzzleId: 'p3',
        kind: CHESS_PUZZLE_INTERACTION_KIND.abandoned,
        at: '2',
      }),
      row({
        puzzleId: 'p4',
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '1',
      }),
    ];
    expect(deriveCurrentStreak(interactions)).toBe(2);
  });
});
