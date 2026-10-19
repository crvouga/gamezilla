/**
 * A puzzle line as its move list shows it: each move the game played, as
 * the game labels it, with the position it was played from.
 */
import type { PuzzleGame } from './puzzle-setup';
import { playPuzzleAction } from './puzzle-setup';
import { lineActions } from './step';

export type PuzzleHistoryPly = {
  /** 0-based index into the line's actions. */
  readonly plyIndex: number;
  /** `solveIdx` after this ply is applied (`plyIndex + 1`). */
  readonly solveIdxAfter: number;
  /** The move as the game's rules name it (`PlayedPosition.label`). */
  readonly label: string;
  /** The position the move was played from. */
  readonly before: string;
};

/**
 * The line's moves through `throughIdx` (exclusive), as far as the game
 * plays them from `position`.
 */
export function buildPuzzleMoveHistory(
  game: PuzzleGame,
  args: { position: string; moves: string; throughIdx: number }
): readonly PuzzleHistoryPly[] {
  if (args.position.length === 0 || !game.rules.recognizes(args.position))
    return [];
  const actions = lineActions(args.moves).slice(
    0,
    Math.max(0, args.throughIdx)
  );
  const plies: PuzzleHistoryPly[] = [];
  let before = args.position;
  for (const [plyIndex, action] of actions.entries()) {
    const played = playPuzzleAction(game, before, action);
    if (played === null) return plies;
    plies.push({
      plyIndex,
      solveIdxAfter: plyIndex + 1,
      label: played.played.label,
      before,
    });
    before = played.played.position;
  }
  return plies;
}
