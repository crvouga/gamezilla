import { describe, expect, test } from 'bun:test';
import { deriveOutcomeScore, hasPendingPlay, hasPlayOutcome, playOutcome } from '@libs/chess-puzzle-shared/chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '@libs/chess-puzzle-shared/chess-puzzle-interaction-entities';

let at = 0;
function row(
  kind: ChessPuzzleInteractionRow['kind'],
  over: Partial<ChessPuzzleInteractionRow> = {}
): ChessPuzzleInteractionRow {
  at += 1;
  return {
    puzzleId: 'p1',
    kind,
    solveIdx: 1,
    uci: null,
    correct: null,
    puzzleRating: 1200,
    at: `2026-09-19T00:00:${String(at).padStart(2, '0')}.000Z`,
    ...over,
  };
}

describe('the play outcome (§5: the first one, once)', () => {
  test('the first outcome row is the play outcome', () => {
    const play = [
      row('started'),
      row('moved', { correct: false }),
      row('failed'),
      row('solved'),
    ];
    expect(playOutcome(play)?.kind).toBe('failed');
    expect(hasPlayOutcome(play, 'p1')).toBe(true);
    expect(hasPendingPlay(play, 'p1')).toBe(false);
    expect(deriveOutcomeScore(play)).toBe(0.5);
  });

  test('a started play with no outcome is pending (restored, not restarted)', () => {
    const play = [row('started'), row('moved', { correct: true })];
    expect(playOutcome(play)).toBeNull();
    expect(hasPendingPlay(play, 'p1')).toBe(true);
    expect(hasPendingPlay(play, 'other')).toBe(false);
  });

  test('clean solve scores 1, assistance 0.5, solution and abandonment 0', () => {
    expect(deriveOutcomeScore([row('started'), row('solved')])).toBe(1);
    expect(
      deriveOutcomeScore([row('started'), row('used-hint'), row('solved')])
    ).toBe(0.5);
    expect(
      deriveOutcomeScore([
        row('started'),
        row('moved', { correct: false }),
        row('failed'),
      ])
    ).toBe(0.5);
    expect(deriveOutcomeScore([row('started'), row('failed')])).toBe(0);
    expect(
      deriveOutcomeScore([row('started'), row('used-hint'), row('failed')])
    ).toBe(0);
    expect(
      deriveOutcomeScore([row('started'), row('used-hint'), row('abandoned')])
    ).toBe(0);
    expect(deriveOutcomeScore([row('started'), row('abandoned')])).toBe(0);
  });

  // §8: the rated outcome is the play's first one. Which attempt the rating
  // mutation accepts is the ledger's job (tests/puzzle-session/rating.test.ts
  // and the product rating scenario); here we pin the score it is handed.
  test('a later row of the same play never changes the rated score', () => {
    const play = [
      row('started'),
      row('moved', { correct: false }),
      row('failed'),
      row('solved'),
    ];
    expect(playOutcome(play)?.kind).toBe('failed');
    expect(deriveOutcomeScore(play)).toBe(0.5);
  });
});
