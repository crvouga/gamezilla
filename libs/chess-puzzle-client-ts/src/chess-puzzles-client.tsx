/**
 * What chess supplies to the platform's puzzle screens: its board, its
 * coach and the companion that speaks the attempt, its Lichess themes, its
 * notations and its sounds.
 */
import {
  CHESS_MOVE_NOTATIONS,
  chessMoveNotationOf,
  chessMoveNumber,
  formatSanNotation,
} from '@libs/chess-puzzle-shared-ts/chess-puzzle-notation';
import { formatChessPuzzleThemeLabel } from '@libs/chess-puzzle-shared-ts/chess-puzzle-theme-label';
import { CHESS_PUZZLE_THEMES } from '@libs/chess-puzzle-shared-ts/chess-puzzle-themes';
import { puzzleCommentary } from '@libs/chess-puzzle-shared-ts/puzzle-commentary';
import type {
  GamePuzzlesClient,
  PuzzleAttempt,
} from '@libs/game-puzzle-client-ts/puzzle-client';
import type { JSX } from 'solid-js';
import { ChessPuzzleAnnouncement } from './chess-puzzle-announcement';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

/** The attempt's moves said in words, for someone listening to the app. */
function ChessPuzzleCompanion(props: {
  readonly attempt: PuzzleAttempt;
}): JSX.Element {
  const a = props.attempt;
  return (
    <ChessPuzzleAnnouncement
      status={a.status}
      moves={a.line}
      solveIdx={a.solveIdx}
      solverSide={a.solverSide}
      hintStage={a.hintStage}
      fen={a.position}
      hintSquare={a.hintFrom}
    />
  );
}

export const chessPuzzlesClient: GamePuzzlesClient = {
  Board: ChessPuzzleBoard,
  coach: (attempt) =>
    puzzleCommentary({
      puzzleId: attempt.puzzleId(),
      fen: attempt.position(),
      status: attempt.status(),
      solveIdx: attempt.solveIdx(),
      layoutKey: attempt.layoutKey(),
      wrongUci: attempt.wrongAction(),
      hint: attempt.hintStage(),
      opponentReplying: attempt.opponentReplying(),
      viewingHistory: attempt.viewingHistory(),
    }),
  Companion: ChessPuzzleCompanion,
  themes: { choices: CHESS_PUZZLE_THEMES, label: formatChessPuzzleThemeLabel },
  notation: {
    choices: CHESS_MOVE_NOTATIONS,
    format: (label, notation) =>
      formatSanNotation(label, chessMoveNotationOf(notation)),
    moveNumber: chessMoveNumber,
  },
  useFeedback: useChessPuzzleFeedback,
};
