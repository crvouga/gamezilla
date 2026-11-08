import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  applySokobanMove,
  encodeSokobanPosition,
  initialSokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-position';
import type { SokobanDirection } from '@libs/sokoban-shared-ts/sokoban-types';

/**
 * Story-only: two crates, two goals. Pushing right twice, then walking
 * round and pushing right twice again, solves it.
 */
export const TWO_CRATES = JSON.stringify({
  format: 1,
  rows: ['#######', '#     #', '# $ . #', '#@$ . #', '#     #', '#######'],
});

/** The supported size limit, with a short push and open space for repeated input. */
export const MAXIMUM_BOARD = JSON.stringify({
  format: 1,
  rows: [
    '#'.repeat(20),
    `#@$ .${' '.repeat(14)}#`,
    ...Array.from({ length: 17 }, () => `#${' '.repeat(18)}#`),
    '#'.repeat(20),
  ],
});

/**
 * The size limit, crowded: 36 crates, 36 goals and rows of pillars, with a
 * clear top row so repeated moves stay legal. Used to time a busy board.
 */
export const DENSE_MAXIMUM_BOARD = JSON.stringify({
  format: 1,
  rows: [
    '#'.repeat(20),
    `# @${' '.repeat(16)}#`,
    ...Array.from(
      { length: 16 },
      (_, row) =>
        [
          `#${' $'.repeat(9)}#`,
          `#${' '.repeat(18)}#`,
          `#${' .'.repeat(9)}#`,
          `#${' #'.repeat(9)}#`,
        ][row % 4] ?? ''
    ),
    `#${' '.repeat(18)}#`,
    '#'.repeat(20),
  ],
});

/** The play state after `moves` from the start of {@link TWO_CRATES}. */
export function playedTwoCrates(moves: readonly SokobanDirection[]): string {
  const board = decodeSokobanBoard(TWO_CRATES);
  if (!board.valid) throw new Error('The story board must be valid');
  const start = initialSokobanPosition(board.value);
  if (!start.valid) throw new Error('The story board must be playable');
  let position = start.value;
  for (const move of moves) {
    const next = applySokobanMove(board.value, position, move);
    if (!next.valid) throw new Error(`Refused move ${move}`);
    position = next.value;
  }
  return encodeSokobanPosition(position);
}

export const SOLVING_MOVES: readonly SokobanDirection[] = [
  'right',
  'right',
  'left',
  'left',
  'up',
  'right',
  'right',
];
