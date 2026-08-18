import { describe, expect, test } from 'bun:test';
import type { ChessPuzzleInteractionRow } from './chess-puzzle-interaction-entities';
import { CHESS_PUZZLE_INTERACTION_KIND } from './chess-puzzle-interaction-entities';
import {
  deriveChessPuzzleGameLog,
  deriveChessPuzzleStats,
} from './chess-puzzle-stats';

function terminal(
  partial: Partial<ChessPuzzleInteractionRow> &
    Pick<ChessPuzzleInteractionRow, 'kind' | 'at'>
): ChessPuzzleInteractionRow {
  return {
    puzzleId: partial.puzzleId ?? 'p1',
    kind: partial.kind,
    solveIdx: partial.solveIdx ?? 0,
    uci: partial.uci ?? null,
    correct: partial.correct ?? null,
    puzzleRating: partial.puzzleRating ?? 1200,
    ratingBefore: partial.ratingBefore ?? 1200,
    ratingAfter: partial.ratingAfter ?? 1210,
    at: partial.at,
  };
}

describe('chess-puzzle-stats', () => {
  test('deriveChessPuzzleStats aggregates terminal rows', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      terminal({
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '2026-01-01T00:00:00.000Z',
        ratingBefore: 1200,
        ratingAfter: 1210,
      }),
      terminal({
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '2026-01-02T00:00:00.000Z',
        puzzleId: 'p2',
        ratingBefore: 1210,
        ratingAfter: 1225,
      }),
      terminal({
        kind: CHESS_PUZZLE_INTERACTION_KIND.abandoned,
        at: '2026-01-03T00:00:00.000Z',
        puzzleId: 'p3',
        ratingBefore: 1225,
        ratingAfter: 1215,
      }),
    ];
    const stats = deriveChessPuzzleStats({ interactions, profileRating: 0 });
    expect(stats.totalPlayed).toBe(3);
    expect(stats.totalSolved).toBe(2);
    expect(stats.accuracy).toBe(67);
    expect(stats.currentElo).toBe(1215);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(2);
    expect(stats.eloSeries).toEqual([1200, 1210, 1225, 1215]);
  });

  test('deriveChessPuzzleGameLog sorts newest first', () => {
    const interactions: ChessPuzzleInteractionRow[] = [
      terminal({
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '2026-01-01T00:00:00.000Z',
        ratingBefore: 1200,
        ratingAfter: 1210,
      }),
      terminal({
        kind: CHESS_PUZZLE_INTERACTION_KIND.solved,
        at: '2026-01-02T00:00:00.000Z',
        puzzleId: 'p2',
        ratingBefore: 1210,
        ratingAfter: 1220,
      }),
    ];
    const log = deriveChessPuzzleGameLog(interactions);
    expect(log).toHaveLength(2);
    expect(log[0]?.at).toBe('2026-01-02T00:00:00.000Z');
    expect(log[0]?.delta).toBe(10);
  });
});
