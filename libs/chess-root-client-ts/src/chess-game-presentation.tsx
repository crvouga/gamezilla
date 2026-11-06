import { BOARD_THEME } from '@libs/chess-root-shared-ts/board-theme';
import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { t } from '@lingui/core/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import { ChessBoardFrame } from '@pkgs/chess-board-root-client-ts/chess-board-frame';
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
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { ComponentProps, JSX } from 'solid-js';

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
 * A phone-sized board reads its coordinates outside the squares
 * (`ChessBoardFrame`), larger than a corner holds.
 */
export function ChessGameBoard(props: GameBoardProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <ChessBoardFrame
      orientation={requireTwoPlayerSide(props.orientation)}
      // Wide, the ranks stand at the end, so the squares start under the
      // screen's title.
      ranks={mode() === 'wide' ? 'end' : 'start'}
    >
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
        highlightLastMove
        highlightLegalMoves
        onMove={(move) =>
          props.onAction(move.from + move.to + (move.promotion ?? ''))
        }
        dataSet={{ testid: props.testId }}
      />
    </ChessBoardFrame>
  );
}
export const chessPresentation: GameClientPresentation = {
  canFlip: true,
  name: () => t`chess`,
  Board: ChessGameBoard,
  sideLabel: (side) => (side === 'white' ? t`White` : t`Black`),
  frame: {
    drawOffers: true,
    players: fixedPlayers(2),
    options: [],
    // White and Black are the pieces' own colors: a king says which.
    seats: lookOnlySeats((side) => ({ mark: side === 'white' ? '♔' : '♚' })),
    createBoard: boardOnly(ChessGameBoard),
    turnStatus: () => null,
    result: (_position, winner) => ({
      scoreLabel: null,
      standings: standingsFromWinner(winner, TWO_PLAYER_SIDES),
    }),
  },
  endingDescription: (reason) => {
    const descriptions: Readonly<Record<string, string>> = {
      checkmate: t`By checkmate.`,
      stalemate: t`By stalemate.`,
      'insufficient material': t`Neither side can checkmate.`,
      repetition: t`By repetition.`,
      'fifty moves': t`By the fifty-move rule.`,
    };
    return descriptions[reason];
  },
  timeoutDrawDescription: (side) => {
    const flagged = side === 'white' ? t`White` : t`Black`;
    return t`${flagged} ran out of time, but the other side cannot checkmate.`;
  },
  endingLabel: (reason) => (reason === 'checkmate' ? t`checkmate` : t`draw`),
};
