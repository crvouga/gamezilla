import { describe, expect, test } from 'bun:test';
import { parseCell } from '../src/word-tiles-board';
import {
  evaluatePlacement,
  type PlacementRefusal,
} from '../src/word-tiles-placement';
import { EMPTY_BOARD } from '../src/word-tiles-position';
import { boardWith } from './word-tiles-fixtures';

/** Letters on cells: `g8C h8a` (a lower-case letter is a blank). */
function placed(text: string) {
  return text.split(' ').map((entry) => {
    const letter = entry.at(-1)!;
    return {
      cell: parseCell(entry.slice(0, -1))!,
      letter: letter.toUpperCase(),
      blank: letter !== letter.toUpperCase(),
    };
  });
}

function total(board: string, text: string): number {
  const evaluation = evaluatePlacement(board, placed(text));
  if (!evaluation.ok) throw new Error(evaluation.refusal);
  return evaluation.score.total;
}

function refusal(board: string, text: string): PlacementRefusal {
  const evaluation = evaluatePlacement(board, placed(text));
  if (evaluation.ok) throw new Error('accepted');
  return evaluation.refusal;
}

const CAT = boardWith([['g8', 'across', 'CAT']]);

describe('the opening move', () => {
  test('across the centre doubles the word', () => {
    // C3 + A1 (h8, double word) + T1 = 5, doubled.
    expect(total(EMPTY_BOARD, 'g8C h8A i8T')).toBe(10);
  });
  test('down the centre doubles the word', () => {
    expect(total(EMPTY_BOARD, 'h7C h8A h9T')).toBe(10);
  });
  test('must cover the centre', () => {
    expect(refusal(EMPTY_BOARD, 'a1C b1A c1T')).toBe('must cover the centre');
  });
  test('must form a word of two letters', () => {
    expect(refusal(EMPTY_BOARD, 'h8A')).toBe('too short');
  });
  test('seven tiles earn the bonus once', () => {
    // R1 E1 T1×3 (f8) A1 I1 (h8 double word) N1 S1×3 (j8) = 11, doubled, + 50.
    expect(total(EMPTY_BOARD, 'd8R e8E f8T g8A h8I i8N j8S')).toBe(72);
  });
  test('a blank is worth nothing but its word bonus square still counts', () => {
    expect(total(EMPTY_BOARD, 'g8C h8a i8T')).toBe(8);
  });
});

describe('placement geometry', () => {
  test('tiles must share one row or column', () => {
    expect(refusal(EMPTY_BOARD, 'g7C h8A')).toBe('not in one line');
  });
  test('the span may not have a gap', () => {
    expect(refusal(EMPTY_BOARD, 'g8C i8T')).toBe('gap in the word');
  });
  test('existing tiles fill the gaps between new ones', () => {
    // S1×3 (f8) + C3 A1 T1 (h8's bonus square is spent) + S1×3 (j8).
    expect(total(CAT, 'f8S j8S')).toBe(11);
  });
  test('two tiles never share a square', () => {
    expect(refusal(EMPTY_BOARD, 'h8C h8A i8T')).toBe('cell taken');
  });
  test('a committed tile is never overwritten', () => {
    expect(refusal(CAT, 'h8O')).toBe('cell taken');
  });
  test('a later move must touch the board', () => {
    expect(refusal(CAT, 'a1A b1T')).toBe('not connected');
  });
  test('no tiles is no placement', () => {
    expect(evaluatePlacement(CAT, [])).toEqual({
      ok: false,
      refusal: 'no tiles',
    });
  });
});

describe('words formed', () => {
  test('one tile can form two words, each scored once', () => {
    const board = boardWith([
      ['g8', 'across', 'CAT'],
      ['g9', 'across', 'A'],
    ]);
    const evaluation = evaluatePlacement(board, placed('h9X'));
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;
    expect(
      evaluation.score.words.map((w) => [w.word, w.direction, w.points])
    ).toEqual([
      ['AX', 'across', 9],
      ['AX', 'down', 9],
    ]);
    expect(evaluation.score.total).toBe(18);
  });
  test('a word the placement does not touch is not scored again', () => {
    const board = boardWith([
      ['g8', 'across', 'CAT'],
      ['h4', 'down', 'DOG'],
    ]);
    const evaluation = evaluatePlacement(board, placed('j8S'));
    expect(evaluation.ok && evaluation.score.words.map((w) => w.word)).toEqual([
      'CATS',
    ]);
  });
  test('cross-words are formed by every new tile', () => {
    const evaluation = evaluatePlacement(CAT, placed('j7A j8S'));
    expect(evaluation.ok && evaluation.score.words.map((w) => w.word)).toEqual([
      'AS',
      'CATS',
    ]);
  });
});
