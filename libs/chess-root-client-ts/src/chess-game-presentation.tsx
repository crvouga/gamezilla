import { BOARD_THEME } from '@libs/chess-root-shared-ts/board-theme';
import { chessPositionDraw } from '@libs/chess-sub-shared-ts/chess-game';
import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { t } from '@lingui/core/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import {
  boardOnly,
  fixedPlayers,
  lookOnlySeats,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  requireTwoPlayerSide,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { ComponentProps, JSX } from '@solidjs/web';

/** How a chess game ended, by the reason its rules give. */
function chessEnding(reason: string): string | undefined {
  const descriptions: Readonly<Record<string, string>> = {
    checkmate: t`By checkmate.`,
    stalemate: t`By stalemate.`,
    'insufficient material': t`Neither side can checkmate.`,
    repetition: t`By repetition.`,
    'fifty moves': t`By the fifty-move rule.`,
  };
  return descriptions[reason];
}

const UCI = /^([a-h][1-8])([a-h][1-8])[qrbn]?$/;

type BoardMove = NonNullable<ComponentProps<typeof ChessBoard>['lastMove']>;

/** A move as its from and to squares, read from the UCI the game writes. */
export function chessMoveSquares(
  action: string | null | undefined
): BoardMove | null {
  const match = UCI.exec(action ?? '');
  if (match === null) return null;
  return { from: match[1], to: match[2] } as BoardMove;
}

/**
 * Chess as every game screen mounts it: the shared chess board in the
 * game's theme, a move sent as its from and to squares and any promotion.
 */
export function ChessGameBoard(props: GameBoardProps): JSX.Element {
  return (
    <ChessBoard
      theme={BOARD_THEME}
      fen={props.position}
      fenSyncKey={props.syncKey}
      lastMove={chessMoveSquares(props.lastAction)}
      orientation={requireTwoPlayerSide(props.orientation)}
      interactive={props.interactive}
      sound={props.sound}
      premoves={false}
      autoPromoteQueen={false}
      showCoordinates
      showGuidance
      highlightLastMove
      highlightLegalMoves
      onMove={(move) =>
        props.onAction(move.from + move.to + (move.promotion ?? ''))
      }
      dataSet={{ testid: props.testId }}
    />
  );
}
export const chessPresentation: GameClientPresentation = {
  canFlip: true,
  name: () => t`chess`,
  goal: () => t`Checkmate the other king to win.`,
  Board: ChessGameBoard,
  sideLabel: (side) => (side === 'white' ? t`White` : t`Black`),
  frame: {
    drawOffers: true,
    // Square board with a seat above and below: fit both in the first view.
    boardFit: 'square',
    players: fixedPlayers(2),
    options: [],
    // Open and filled circles identify the mover independently of the piece.
    seats: lookOnlySeats((side) => ({ mark: side === 'white' ? '○' : '●' })),
    createBoard: boardOnly(ChessGameBoard),
    turnStatus: () => null,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, TWO_PLAYER_SIDES),
    }),
  },
  endingDescription: chessEnding,
  rulesDrawDescription: (position) => {
    const reason = chessPositionDraw(position);
    return reason === null ? undefined : chessEnding(reason);
  },
  timeoutDrawDescription: (side) => {
    const flagged = side === 'white' ? t`White` : t`Black`;
    return t`${flagged} ran out of time, but the other side cannot checkmate.`;
  },
  endingLabel: (reason) => (reason === 'checkmate' ? t`checkmate` : t`draw`),
};
