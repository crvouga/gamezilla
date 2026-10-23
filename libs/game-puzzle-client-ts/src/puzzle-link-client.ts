import { PUZZLE_LINK_ROUTE } from '@libs/game-puzzle-shared-ts/puzzle-link';
import { defineSubClient } from '@libs/sub-client-ts/client';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { createComponent } from 'solid-js';
import { PuzzleLinkScreen } from './puzzle-link-screen';

/**
 * Shared puzzle links open outside the space's game screens, for every
 * registered game offering puzzles: a link's puzzle id names its game by
 * its namespace. The route keeps its established path.
 */
export function createPuzzleLinkClient(turnGames: TurnGames) {
  return defineSubClient({
    name: 'puzzle-link',
    routes: [
      {
        path: PUZZLE_LINK_ROUTE,
        component: () => createComponent(PuzzleLinkScreen, { turnGames }),
      },
    ],
  });
}
