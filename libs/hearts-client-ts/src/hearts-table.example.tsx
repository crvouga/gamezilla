import {
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { cardLabel } from '@libs/hearts-shared-ts/hearts-cards';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { heartsPresentation } from './hearts-presentation';

/** The cards played so far this deal, as the app's move list writes them. */
export function heartsMoves(position: string): readonly string[] {
  return decodeHearts(position)?.plays.map(cardLabel) ?? [];
}

/**
 * The Hearts table in the production frame, its move list showing the cards
 * played as the app shows them: no seat beside a move, since Hearts' rules,
 * not a fixed rotation, say who plays next. A story's own `moves` win.
 */
export function renderHeartsTable(
  args: GameBoardProps,
  context: Parameters<typeof renderGameTable>[3]
): JSX.Element {
  const table = (context.parameters['table'] ?? {}) as GameTableStory;
  return renderGameTable(heartsPresentation, GAME_SIDES, args, {
    ...context,
    parameters: {
      ...context.parameters,
      table: {
        seatedMoves: false,
        ...table,
        get moves() {
          return table.moves ?? heartsMoves(args.position);
        },
      },
    },
  });
}
