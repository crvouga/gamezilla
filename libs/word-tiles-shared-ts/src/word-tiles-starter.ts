import type { StarterContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { parseCell } from './word-tiles-board';
import { DEFAULT_LEXICON_KEY } from './word-tiles-lexicon';
import { EMPTY_BOARD } from './word-tiles-position';
import { encodePuzzle } from './word-tiles-puzzle';
import { RULESET } from './word-tiles-ruleset';

/**
 * The introductory pack: five original one-move challenges, each with a
 * witness (a placement that reaches its target), scored here by hand:
 *
 * 1. CAT on g8–i8: C3 + A1 + T1 = 5, doubled on the centre = 10.
 * 2. ZOO on f8–h8: Z10 × 3 on f8 + O1 + O1 = 32, doubled = 64 (target 60).
 * 3. CAT on the board; S on j8: C3 + A1 + T1 + S1 × 3 on j8 = 8 (the centre's
 *    double word is spent).
 * 4. RETAINS on d8–j8: R1 E1 T1 × 3 A1 I1 N1 S1 × 3 = 11, doubled = 22, plus 50
 *    for all seven tiles = 72 (target 70).
 * 5. HOUSE on the board; the blank as D on k8: H4 O1 U1 S1 E1 D0 = 8.
 */
function boardOf(start: string, letters: string): string {
  const cells = EMPTY_BOARD.split('');
  const first = parseCell(start) ?? 0;
  [...letters].forEach((letter, n) => {
    cells[first + n] = letter;
  });
  return cells.join('');
}

function puzzle(board: string, rack: string, target: number): string {
  return encodePuzzle({
    ruleset: RULESET.id,
    lexicon: DEFAULT_LEXICON_KEY,
    board,
    rack,
    target,
  });
}

function witness(played: string, score: number): string {
  return JSON.stringify({ v: 1, played, score });
}

export const WORD_TILES_STARTER: StarterContent = {
  pack: {
    id: 'first-moves',
    title: 'First moves',
    description:
      'Five one-move challenges: score at least the target with the rack you are given.',
  },
  puzzles: [
    {
      id: 'first-word',
      title: 'First word',
      description: 'Cover the centre star with a word of your own.',
      difficulty: 'easy',
      definition: puzzle(EMPTY_BOARD, 'CATDOGS', 10),
      witness: witness('play:g8=0.h8=1.i8=2', 10),
    },
    {
      id: 'letter-bonus',
      title: 'Letter bonus',
      description: 'Put your best tile on a triple-letter square.',
      difficulty: 'easy',
      definition: puzzle(EMPTY_BOARD, 'ZOOKEAR', 60),
      witness: witness('play:f8=0.g8=1.h8=2', 64),
    },
    {
      id: 'make-it-longer',
      title: 'Make it longer',
      description: 'Add to the word on the board.',
      difficulty: 'easy',
      definition: puzzle(boardOf('g8', 'CAT'), 'SHOEING', 8),
      witness: witness('play:j8=0', 8),
    },
    {
      id: 'all-seven',
      title: 'All seven',
      description: 'Use every tile in your rack for the bonus.',
      difficulty: 'medium',
      definition: puzzle(EMPTY_BOARD, 'RETAINS', 70),
      witness: witness('play:d8=0.e8=1.f8=2.g8=3.h8=4.i8=5.j8=6', 72),
    },
    {
      id: 'blank-tile',
      title: 'Blank tile',
      description: 'A blank plays any letter, for no points.',
      difficulty: 'easy',
      definition: puzzle(boardOf('f8', 'HOUSE'), '?TRAPLE', 8),
      witness: witness('play:k8=0D', 8),
    },
  ],
};
