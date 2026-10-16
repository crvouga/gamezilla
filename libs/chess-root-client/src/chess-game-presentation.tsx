import { BOARD_THEME } from '@libs/chess-root-shared/board-theme';
import { t } from '@lingui/core/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import type {
  GameBoardProps,
  GamePresentation,
} from '@pkgs/turn-game-shared/game-presentation';
import type { JSX } from 'solid-js';

function ChessGameBoard(props: GameBoardProps): JSX.Element {
  return (
    <ChessBoard
      theme={BOARD_THEME}
      fen={props.position}
      fenSyncKey={props.syncKey}
      orientation={props.orientation}
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
export const chessPresentation: GamePresentation<JSX.Element> = {
  id: 'chess',
  canFlip: true,
  name: () => t`chess`,
  Board: ChessGameBoard,
  sideLabel: (side) => (side === 'white' ? t`White` : t`Black`),
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
