import { beforeAll, describe, expect, test } from 'bun:test';
import { starterContentProblems } from '@libs/game-puzzle-shared-ts/starter-content';
import { wordTilesGameShared } from '@libs/word-tiles-shared-ts/word-tiles-game';
import { EMPTY_BOARD } from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  decodePuzzle,
  encodePuzzle,
  scorePlacement,
  wordTilesPuzzleContent,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { WORD_TILES_STARTER } from '@libs/word-tiles-shared-ts/word-tiles-starter';
import { boardWith, lexicon } from './word-tiles-fixtures';

beforeAll(async () => {
  await lexicon();
});

const rules = wordTilesPuzzleContent.rules;
const CAT = boardWith([['g8', 'across', 'CAT']]);
const STARTER_SCORES: Readonly<Record<string, number>> = {
  'first-word': 10,
  'letter-bonus': 64,
  'make-it-longer': 8,
  'all-seven': 72,
  'blank-tile': 8,
};

function definition(board: string, rack: string, target: number) {
  return encodePuzzle({
    ruleset: 'r1',
    lexicon: 'enable1.90ef7a729517',
    board,
    rack,
    target,
  });
}

describe('one-move challenges', () => {
  test('every starter puzzle is proven by its witness, at the score worked out by hand', () => {
    expect(starterContentProblems(wordTilesGameShared)).toEqual([]);
    for (const puzzle of WORD_TILES_STARTER.puzzles) {
      const action = puzzle.witness[0] ?? '';
      expect(puzzle.witness).toHaveLength(1);
      const decoded = decodePuzzle(puzzle.definition);
      if (!decoded.valid) throw new Error(puzzle.id);
      expect(scorePlacement(decoded.value, action)).toEqual({
        valid: true,
        value: STARTER_SCORES[puzzle.id]!,
      });
    }
  });

  test('a placement is scored against the frozen board; lower scores never add up', () => {
    const def = definition(CAT, 'SHOEING', 20);
    const start = rules.initial(def);
    if (!start.accepted) throw new Error('refused');
    const low = rules.apply(def, start.state, 'play:j8=0');
    expect(low.accepted).toBe(true);
    if (!low.accepted) return;
    expect(rules.complete(def, low.state)).toBe(false);
    // Another placement is judged on the same frozen board, not after the first.
    const again = rules.apply(def, low.state, 'play:j8=0');
    expect(again.accepted && rules.complete(def, again.state)).toBe(false);
  });

  test('a placement the rules refuse is refused with a reason and changes nothing', () => {
    const def = definition(EMPTY_BOARD, 'CATDOGS', 10);
    const start = rules.initial(def);
    if (!start.accepted) throw new Error('refused');
    for (const action of [
      'play:a1=0.b1=1',
      'play:g8=0.h8=0',
      'play:h8=0.i8=3',
      'swap:0',
      'nonsense',
    ])
      expect(rules.apply(def, start.state, action).accepted).toBe(false);
  });

  test('a definition must fit the tile set, join through the centre and spell words', () => {
    const issue = (def: string) => {
      const v = rules.validateDefinition(def);
      return v.valid ? null : v.issues[0]?.code;
    };
    expect(issue(definition(EMPTY_BOARD, 'ZZOOKEA', 10))).toBe('inventory');
    expect(
      issue(definition(boardWith([['a1', 'across', 'CAT']]), 'SHOEING', 5))
    ).toBe('board-connected');
    expect(
      issue(definition(boardWith([['g8', 'across', 'CXT']]), 'SHOEING', 5))
    ).toBe('board-words');
    expect(issue(definition(CAT, 'SHOEING', 0))).toBe('target');
    expect(issue(definition(CAT, 'SHOEINGS', 5))).toBe('rack');
    expect(issue(definition(CAT, 'SHOEING', 5))).toBeNull();
  });

  test('publication needs a witness that reaches the target, or a search that finds one', () => {
    const def = definition(EMPTY_BOARD, 'CATDOGS', 10);
    const short = JSON.stringify({ v: 1, played: 'play:h8=0.i8=1', score: 99 });
    expect(
      wordTilesPuzzleContent.validatePublication?.(def, {
        actions: ['play:h8=0.i8=1'],
        state: short,
      }).valid
    ).toBe(false);
    expect(wordTilesPuzzleContent.validatePublication?.(def).valid).toBe(true);
    const impossible = definition(EMPTY_BOARD, 'QZ', 500);
    expect(wordTilesPuzzleContent.solver?.solve(impossible).status).toBe(
      'unsolvable'
    );
  });
});
