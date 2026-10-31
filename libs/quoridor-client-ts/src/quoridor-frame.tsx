import { decodeQuoridor } from '@libs/quoridor-shared-ts/quoridor';
import { QUORIDOR_SIDES } from '@libs/quoridor-shared-ts/quoridor-rules';
import { t } from '@lingui/core/macro';
import {
  type FramePlayerColor,
  fixedPlayers,
  type GameFrame,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { createQuoridorBoard } from './quoridor-board';
import { PAWN_GLYPHS, quoridorPlayerName } from './quoridor-board-cells';

/** Each pawn's color, as its name says: red, gold, green and black. */
const PAWN_COLORS: readonly FramePlayerColor[] = [7, 5, 8, 6];

const playerOf = (side: GameSide) => QUORIDOR_SIDES.indexOf(side);

/**
 * Whose turn it is and where that pawn is heading: in Classic, the opposite
 * home row (South to row 9, North to row 1); in King of the Hill, e5 for
 * everyone. Nothing once the game is won.
 */
function quoridorTurnStatus(
  position: string,
  viewer: GameSide | null
): string | null {
  const game = decodeQuoridor(position);
  if (game.winner !== null) return null;
  const yours = viewer !== null && playerOf(viewer) === game.turn;
  const name = quoridorPlayerName(game, game.turn);
  if (game.mode === 'hill')
    return yours
      ? t`Your turn. First to e5 wins.`
      : t`${name} to move. First to e5 wins.`;
  const row = game.turn === 0 ? '9' : '1';
  return yours
    ? t`Your turn. Reach row ${row}.`
    : t`${name} to move, heading for row ${row}.`;
}

/** Two or four pawns; beside each, the walls it has left to place. */
export function quoridorFrame(hill: boolean): GameFrame<JSX.Element> {
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
    createBoard: createQuoridorBoard,
    turnStatus: quoridorTurnStatus,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, sides),
    }),
  };
}
