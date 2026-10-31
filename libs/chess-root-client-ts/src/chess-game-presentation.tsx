import { BOARD_THEME } from '@libs/chess-root-shared-ts/board-theme';
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
import type { JSX } from 'solid-js';

function ChessGameBoard(props: GameBoardProps): JSX.Element {
  return (
    <ChessBoard
      theme={BOARD_THEME}
      fen={props.position}
      fenSyncKey={props.syncKey}
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
  );
}
export const chessPresentation: GameClientPresentation = {
  canFlip: true,
  name: () => t`chess`,
  Board: ChessGameBoard,
  sideLabel: (side) => (side === 'white' ? t`White` : t`Black`),
  frame: {
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
