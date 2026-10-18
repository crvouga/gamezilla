/**
 * The space's puzzle session as a scenario reaches it below the screens: a
 * command as a (possibly modified) client sends it, and what the session's
 * room state holds. For specifications that prove the room — not the
 * screen — refuses or accepts something.
 */
import { PuzzlePlayAttr } from '@libs/game-puzzle-shared/play-attr';
import {
  RequestPuzzleHint,
  ResetPuzzlePlay,
  RevealPuzzleSolution,
  ShowPuzzleSolution,
  SkipPuzzlePlay,
  StepBackPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared/play-messages';
import { lineActions } from '@libs/game-puzzle-shared/step';
import type {
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared/types';

/** One command of the puzzle session. */
export type PuzzleSessionCommand =
  | { readonly kind: 'move'; readonly action: string }
  | {
      readonly kind:
        | 'skip'
        | 'hint'
        | 'show-line'
        | 'solution'
        | 'step'
        | 'retry';
    };

/** `command` as the room's command payload. */
export function puzzleSessionCommand(
  command: PuzzleSessionCommand
): RoomCommandPayload {
  switch (command.kind) {
    case 'move':
      return SubmitPuzzleMove({ uci: command.action });
    case 'skip':
      return SkipPuzzlePlay({});
    case 'hint':
      return RequestPuzzleHint({});
    case 'show-line':
      return ShowPuzzleSolution({});
    case 'solution':
      return RevealPuzzleSolution({});
    case 'step':
      return StepBackPuzzlePlay({});
    case 'retry':
      return ResetPuzzlePlay({});
  }
}

/** What the session holds: who solves, the line, how far, the board. */
export type PuzzleSessionView = {
  readonly hostIdentity: string | null;
  readonly line: readonly string[];
  readonly solveIdx: number;
  readonly displayPosition: string | null;
};

export function readPuzzleSession(state: RoomState): PuzzleSessionView {
  return {
    hostIdentity: PuzzlePlayAttr.hostIdentity.from(state),
    line: lineActions(PuzzlePlayAttr.line.from(state)),
    solveIdx: PuzzlePlayAttr.solveIdx.from(state),
    displayPosition: PuzzlePlayAttr.displayPosition.from(state),
  };
}
