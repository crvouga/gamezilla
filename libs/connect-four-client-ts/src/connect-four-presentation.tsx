import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { t } from '@lingui/core/macro';
import {
  boardOnly,
  fixedPlayers,
  lookOnlySeats,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { ConnectFourBoard } from './connect-four-board';

/**
 * Connect Four as every game screen mounts it: the drop board, with a
 * column drop sent as the action naming that column.
 */
export function ConnectFourGameBoard(props: GameBoardProps): JSX.Element {
  return (
    <ConnectFourBoard
      position={props.position}
      interactive={props.interactive}
      testId={props.testId}
      onDrop={(column) => props.onAction(String(column))}
    />
  );
}
export const connectFourPresentation: GameClientPresentation = {
  canFlip: false,
  name: () => t`Connect Four`,
  Board: ConnectFourGameBoard,
  sideLabel: (side) => (side === 'white' ? t`Red circle` : t`Yellow diamond`),
  // A move is its column's number: the record says so beside it.
  movePrefix: () => t`col`,
  frame: {
    drawOffers: true,
    players: fixedPlayers(2),
    options: [],
    // The disc each side drops: the board's own disc paint, so the seat
    // matches its discs in every theme, and its shape.
    seats: lookOnlySeats((side) =>
      side === 'white'
        ? { color: 'disc-one', mark: '●' }
        : { color: 'disc-two', mark: '◆' }
    ),
    createBoard: boardOnly(ConnectFourGameBoard),
    turnStatus: () => null,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, TWO_PLAYER_SIDES),
    }),
  },
  endingDescription: (reason) => {
    const descriptions: Readonly<Record<string, string>> = {
      'four in a row': t`Four in a row.`,
      'full board': t`The board is full. Game drawn.`,
    };
    return descriptions[reason];
  },
  timeoutDrawDescription: (side) => {
    const flagged = side === 'white' ? t`Red circle` : t`Yellow diamond`;
    return t`${flagged} ran out of time, but the other side cannot win.`;
  },
  endingLabel: (reason) =>
    reason === 'four in a row' ? t`four in a row` : t`full board`,
};
