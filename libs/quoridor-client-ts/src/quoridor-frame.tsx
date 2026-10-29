import { decodeQuoridor } from '@libs/quoridor-shared-ts/quoridor';
import { QUORIDOR_SIDES } from '@libs/quoridor-shared-ts/quoridor-rules';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  type FramePlayerColor,
  fixedPlayers,
  type GameFrame,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { PAWN_GLYPHS } from './quoridor-board-cells';

/** Each pawn's color, as its name says: red, gold, green and black. */
const PAWN_COLORS: readonly FramePlayerColor[] = [7, 5, 8, 6];

const playerOf = (side: GameSide) => QUORIDOR_SIDES.indexOf(side);

/** Two or four pawns; beside each, the walls it has left to place. */
export function quoridorFrame(
  hill: boolean,
  Board: (props: GameBoardProps) => JSX.Element
): GameFrame<JSX.Element> {
  const sides = hill ? QUORIDOR_SIDES : QUORIDOR_SIDES.slice(0, 2);
  return {
    players: fixedPlayers(hill ? 4 : 2),
    options: [],
    seats: {
      look: (side) => ({
        color: PAWN_COLORS[playerOf(side)] ?? 1,
        mark: PAWN_GLYPHS[playerOf(side)] ?? '',
      }),
      stat: (position, side) => ({
        label: t`Walls`,
        value: String(decodeQuoridor(position).remaining[playerOf(side)] ?? 0),
      }),
      facts: () => [],
      out: () => false,
    },
    createBoard: boardOnly(Board),
    turnStatus: () => null,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, sides),
    }),
  };
}
