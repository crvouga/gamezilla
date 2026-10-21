import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { PuzzlePlayAttr } from './play-attr';
import type { PuzzleGame } from './puzzle-setup';

/**
 * The game a puzzle's position belongs to: the game, `null` when no game
 * recognises the position (the puzzle cannot be set up), or `'unoffered'`
 * when its game does not offer puzzles.
 */
export type PuzzleGameLookup = (
  position: string
) => PuzzleGame | null | 'unoffered';

export /** The game of the puzzle in play; `null` while none can be played. */
function gameInPlay(
  state: RoomState,
  lookup: PuzzleGameLookup
): PuzzleGame | null {
  const game = lookup(PuzzlePlayAttr.position.from(state));
  return game === 'unoffered' ? null : game;
}
