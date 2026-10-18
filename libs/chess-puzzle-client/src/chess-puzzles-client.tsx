/**
 * What chess supplies to the platform's puzzle screens: its board, its
 * coach and the companion that speaks the attempt (and, in test builds,
 * shows its probes), its Lichess themes, its notations and its sounds.
 */
import {
  CHESS_MOVE_NOTATIONS,
  chessMoveNotationOf,
  chessMoveNumber,
  formatSanNotation,
} from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { formatChessPuzzleThemeLabel } from '@libs/chess-puzzle-shared/chess-puzzle-theme-label';
import { CHESS_PUZZLE_THEMES } from '@libs/chess-puzzle-shared/chess-puzzle-themes';
import { puzzleCommentary } from '@libs/chess-puzzle-shared/puzzle-commentary';
import type {
  GamePuzzlesClient,
  PuzzleAttempt,
} from '@libs/game-puzzle-client/puzzle-client';
import type { JSX } from 'solid-js';
import { ChessPuzzleAnnouncement } from './chess-puzzle-announcement';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import { ChessPuzzleTestHints } from './chess-puzzle-test-hints';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

/** The attempt said in words, and the probes chess's scenarios read. */
function ChessPuzzleCompanion(props: {
  readonly attempt: PuzzleAttempt;
}): JSX.Element {
  const a = props.attempt;
  return (
    <>
      <ChessPuzzleAnnouncement
        status={a.status}
        moves={a.line}
        solveIdx={a.solveIdx}
        solverSide={a.solverSide}
        hintStage={a.hintStage}
        fen={a.position}
        hintSquare={a.hintFrom}
        completion={a.completion}
      />
      <ChessPuzzleTestHints
        orientation={a.solverSide}
        status={a.status}
        solveIdx={a.solveIdx}
        moves={a.line}
        interactive={a.interactive}
        solutionUci={a.nextAction}
        expectedFromSquare={a.hintFrom}
        expectedToSquare={a.hintTo}
        hintStage={a.hintStage}
        displayFen={a.position}
        spectating={a.spectating}
        spaceRole={a.spaceRole}
        statusKind={a.statusKind}
        clockElapsedMs={a.clockElapsedMs}
        puzzleRating={a.rating}
        themes={a.themes}
        recommendations={a.suggestionsProbe}
      />
    </>
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
