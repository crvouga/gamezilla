import type { SharedGameModule } from '@libs/spaces-shared-ts/game';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { puzzlePlayCmdNs, puzzlePlayEvtNs } from './play-messages';
import { puzzlePlayEventReducer, puzzlePlayInitialAttrs } from './play-reducer';
import { createPuzzlePlayCommandRouter } from './play-router';
import type { PuzzleGameLookup } from './puzzle-game-lookup';
import {
  puzzleReviewCmdNs,
  puzzleReviewCommandRouter,
  puzzleReviewEventReducer,
  puzzleReviewEvtNs,
} from './puzzle-review-selection';

/**
 * The game a puzzle's position belongs to, among the registered games: the
 * one game recognising it (positions name exactly one game), refused when
 * that game does not offer puzzles.
 */
export function puzzleGamesOf(games: TurnGames): PuzzleGameLookup {
  return (position) => {
    if (!games.games.some((game) => game.rules.recognizes(position)))
      return null;
    const rules = games.forPosition(position);
    const puzzles = games.capability(rules.id, 'puzzles');
    return puzzles === undefined ? 'unoffered' : { rules, puzzles };
  };
}

/**
 * The space's puzzle session, installed once in every space whose games
 * offer puzzles (`defineTurnGame` declares it for a game with
 * `capabilities.puzzles`): one host solves a puzzle of any such game while
 * the space watches and suggests, and the puzzle the space reviews from its
 * stats. Its room state and messages keep their durable names
 * (`chess.puzzle.*`, `chess-puzzle-play-cmd` / `-evt`, and the review's
 * `chess.main-menu.selected-review-*` in `chess-cmd` / `chess-evt`).
 */
export const PUZZLE_SESSIONS: SharedGameModule = {
  id: 'puzzle-session',
  bind: (games) => ({
    id: 'puzzle-session',
    commandRouters: [
      {
        namespace: puzzlePlayCmdNs,
        router: createPuzzlePlayCommandRouter(puzzleGamesOf(games)),
      },
      { namespace: puzzleReviewCmdNs, router: puzzleReviewCommandRouter },
    ],
    eventRouters: [
      { namespace: puzzlePlayEvtNs, router: puzzlePlayEventReducer },
      { namespace: puzzleReviewEvtNs, router: puzzleReviewEventReducer },
    ],
    initialState: puzzlePlayInitialAttrs,
    recoverEffects: () => [],
  }),
};
