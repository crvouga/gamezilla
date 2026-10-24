/**
 * Chess's puzzle board: the platform's position, marks and suggestions on
 * chess's board. A move is reported in UCI, never auto-queened (§3:
 * underpromotion puzzles exist); a hint dots its piece, a wrong move is
 * crossed, the shown solution and each suggestion are arrows.
 */
import { chessPuzzleCellFeedback } from '@libs/chess-puzzle-shared-ts/cell-feedback';
import { chessPuzzleArrows } from '@libs/chess-puzzle-shared-ts/recommendation-arrows';
import { BOARD_THEME } from '@libs/chess-root-shared-ts/board-theme';
import type { PuzzleBoardProps } from '@libs/game-puzzle-client-ts/puzzle-client';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import { formatUci } from '@pkgs/chess-rules-shared-ts/uci';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { requireTwoPlayerSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { type JSX, Show } from 'solid-js';

function PlayBoard(props: PuzzleBoardProps): JSX.Element {
  // Chess's boards follow the app's sound preference themselves.
  const sounds = useSoundsPreference();
  return (
    <ChessBoard
      theme={BOARD_THEME}
      sound={!sounds.muted()}
      dataSet={{ testid: props.testId }}
      size={props.size}
      fen={props.position}
      fenSyncKey={props.syncKey}
      orientation={requireTwoPlayerSide(props.orientation)}
      animationDurationMs={props.moveMs ?? undefined}
      interactive={props.interactive}
      onMove={(move) => props.onAction(formatUci(move))}
      autoPromoteQueen={false}
      showCoordinates
      highlightLastMove
      highlightLegalMoves
      cellFeedback={chessPuzzleCellFeedback(props.marks)}
      arrows={chessPuzzleArrows({
        solution: props.marks.solution,
        suggestions: props.suggestions,
      })}
    />
  );
}

function ReviewBoard(props: PuzzleBoardProps): JSX.Element {
  const sounds = useSoundsPreference();
  return (
    <ChessBoard
      theme={BOARD_THEME}
      sound={!sounds.muted()}
      dataSet={{ testid: props.testId }}
      size={props.size}
      fen={props.position}
      fenSyncKey={props.syncKey}
      orientation={requireTwoPlayerSide(props.orientation)}
      interactive={false}
      animations={props.animated}
      showCoordinates
      highlightLastMove
    />
  );
}

export function ChessPuzzleBoard(props: PuzzleBoardProps): JSX.Element {
  return (
    <Show when={props.mode === 'play'} fallback={<ReviewBoard {...props} />}>
      <PlayBoard {...props} />
    </Show>
  );
}
