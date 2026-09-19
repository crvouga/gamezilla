import { describe, expect, test } from 'bun:test';
import { outcomeForTransition } from '@libs/chess/public/chess-puzzle/chess-puzzle-interaction-status-sync';
import {
  deriveOutcomeScore,
  hasPendingPlay,
  hasPlayOutcome,
  playOutcome,
} from '@libs/chess/public/chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import {
  PUZZLE_ELO_DEFAULT,
  projectPuzzleEloFromInteractions,
} from '@libs/chess/public/chess-puzzle-rating';

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
    expect(deriveOutcomeScore(play)).toBe(0);
  });

  test('a started play with no outcome is pending (restored, not restarted)', () => {
    const play = [row('started'), row('moved', { correct: true })];
    expect(playOutcome(play)).toBeNull();
    expect(hasPendingPlay(play, 'p1')).toBe(true);
    expect(hasPendingPlay(play, 'other')).toBe(false);
  });

  test('a clean solve scores 1, a hinted solve 0.5, a fail and an abandon 0', () => {
    expect(deriveOutcomeScore([row('started'), row('solved')])).toBe(1);
    expect(
      deriveOutcomeScore([row('started'), row('used-hint'), row('solved')])
    ).toBe(0.5);
    expect(deriveOutcomeScore([row('started'), row('failed')])).toBe(0);
    expect(deriveOutcomeScore([row('started'), row('abandoned')])).toBe(0);
  });

  test('rating folds one outcome per play — later rows never re-rate', () => {
    const failedThenSolved = projectPuzzleEloFromInteractions([
      row('started'),
      row('moved', { correct: false }),
      row('failed'),
      row('solved'),
    ]);
    expect(failedThenSolved.ratedGames).toBe(1);
    expect(failedThenSolved.entries[0]).toMatchObject({ outcome: 'failed' });
    expect(failedThenSolved.rating).toBeLessThan(PUZZLE_ELO_DEFAULT);

    // A second play of the same puzzle is rated again on its own outcome.
    const replayed = projectPuzzleEloFromInteractions([
      row('started'),
      row('failed'),
      row('started'),
      row('solved'),
    ]);
    expect(replayed.ratedGames).toBe(2);
    expect(replayed.entries.map((entry) => entry.outcome)).toEqual([
      'failed',
      'solved',
    ]);
  });
});

describe('outcomeForTransition', () => {
  test('a live attempt decides the outcome', () => {
    expect(outcomeForTransition('solving', 'wrong')).toBe('failed');
    expect(outcomeForTransition('solving', 'revealed')).toBe('failed');
    expect(outcomeForTransition('wrong', 'revealed')).toBe('failed');
    expect(outcomeForTransition('solving', 'solved')).toBe('solved');
    expect(outcomeForTransition('solving', 'skipped')).toBe('abandoned');
    expect(outcomeForTransition('wrong', 'skipped')).toBe('abandoned');
  });

  test('a restore (first read after mount or reload) decides nothing', () => {
    for (const status of ['solving', 'wrong', 'solved', 'revealed'] as const) {
      expect(outcomeForTransition(null, status)).toBeNull();
      expect(outcomeForTransition('loading', status)).toBeNull();
    }
    expect(outcomeForTransition('solved', 'solving')).toBeNull();
    expect(outcomeForTransition('wrong', 'solving')).toBeNull();
    expect(outcomeForTransition('solving', 'solving')).toBeNull();
  });
});
