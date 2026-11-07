/**
 * Chess's puzzle board: the platform's position, marks and suggestions on
 * chess's board. A move is reported in UCI, never auto-queened (§3:
 * underpromotion puzzles exist); a hint outlines its square, a wrong move is
 * crossed, the shown solution and each suggestion are arrows.
 */

import { chessPuzzleLastMove } from '@libs/chess-puzzle-shared-ts/last-move';
import { BOARD_THEME } from '@libs/chess-root-shared-ts/board-theme';
import type { PuzzleBoardProps } from '@libs/game-puzzle-client-ts/puzzle-client';
import { ChessBoard } from '@pkgs/chess-board-root-client-ts/chess-board';
import { formatUci } from '@pkgs/chess-rules-shared-ts/uci';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { requireTwoPlayerSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Show } from 'solid-js';
import { puzzleBoardArrows } from './puzzle-board-arrows';
import { puzzleBoardFeedback } from './puzzle-board-feedback';

function PlayBoard(props: PuzzleBoardProps): JSX.Element {
  // Chess's boards follow the app's sound preference themselves.
  const sounds = useSoundsPreference();
  const mode = useLayoutMode();
  return (
    <ChessBoard
      guidancePlacement="after"
      theme={BOARD_THEME}
      sound={!sounds.muted()}
      dataSet={{ testid: props.testId }}
      fen={props.position}
      fenSyncKey={props.syncKey}
      orientation={requireTwoPlayerSide(props.orientation)}
      animations={props.animated}
      animationDurationMs={props.moveMs ?? undefined}
      interactive={props.interactive}
      onMove={(move) => props.onAction(formatUci(move))}
      autoPromoteQueen={false}
      showCoordinates
      showGuidance
      coordinatePlacement={mode() === 'wide' ? 'outside-end' : 'outside-start'}
      highlightLastMove
      lastMove={chessPuzzleLastMove(props.lastAction)}
      highlightLegalMoves
      cellFeedback={puzzleBoardFeedback(props.marks)}
      arrows={puzzleBoardArrows({
        solution: props.marks.solution,
        suggestions: props.suggestions,
      })}
    />
  );
}

function ReviewBoard(props: PuzzleBoardProps): JSX.Element {
  const sounds = useSoundsPreference();
  const mode = useLayoutMode();
  return (
    <ChessBoard
      fitSquare
      theme={BOARD_THEME}
      sound={!sounds.muted()}
      dataSet={{ testid: props.testId }}
      fen={props.position}
      fenSyncKey={props.syncKey}
      orientation={requireTwoPlayerSide(props.orientation)}
      interactive={false}
      animations={props.animated}
      showCoordinates
      coordinatePlacement={mode() === 'wide' ? 'outside-end' : 'outside-start'}
      highlightLastMove
    />
  );
}

/**
 * Chess's board for the platform's puzzle screens, its coordinates outside
 * the squares through the public board's coordinate placement, filling the
 * well the screen measured: in `play` the solver's
 * moves (reported in UCI, never auto-queened), a hint's square outline, a wrong
 * move's cross and the solution and suggestions as arrows; in `review` a
 * read-only position stepping through the line.
 */
export function ChessPuzzleBoard(props: PuzzleBoardProps): JSX.Element {
  return (
    <Show when={props.mode === 'play'} fallback={<ReviewBoard {...props} />}>
      <PlayBoard {...props} />
    </Show>
  );
}
