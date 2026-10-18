/**
 * The puzzle's live region: everything the board shows about the puzzle,
 * said in words for someone listening to the app — the setup move and whose
 * move it is, each opponent reply, a wrong move, the piece a hint picks, the
 * result and the rating change.
 */

import {
  type PuzzleAnnouncementPart,
  type PuzzleSide,
  puzzleAnnouncement,
  spokenPiece,
} from '@libs/chess-puzzle-shared/puzzle-announcement';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import { Handles } from '@libs/test-ids-shared/handles';
import { t } from '@lingui/core/macro';
import { type Accessor, createMemo, type JSX } from 'solid-js';

function sideWord(side: PuzzleSide): string {
  return side === 'white' ? t`White` : t`Black`;
}

function ratingWords(delta: number, after: number): string {
  if (delta > 0) return t`Your puzzle rating went up by ${delta}, to ${after}.`;
  if (delta < 0) {
    const down = -delta;
    return t`Your puzzle rating went down by ${down}, to ${after}.`;
  }
  return t`Your puzzle rating stayed at ${after}.`;
}

function partWords(part: PuzzleAnnouncementPart): string {
  if (part.kind === 'opponentMove') {
    const side = sideWord(part.side);
    return part.setup
      ? t`Setup move: ${side} played ${part.from} to ${part.to}.`
      : t`Opponent's reply: ${side} played ${part.from} to ${part.to}.`;
  }
  if (part.kind === 'solverMove') {
    return t`You played ${part.from} to ${part.to}.`;
  }
  if (part.kind === 'toMove') {
    const side = sideWord(part.side);
    return t`${side} to move. Find the best move.`;
  }
  if (part.kind === 'wrong') return t`Wrong move. That is not the solution.`;
  if (part.kind === 'hint') {
    const side = sideWord(part.side);
    const piece = spokenPiece(part.piece);
    return t`Hint: move the ${side} ${piece} on ${part.square}.`;
  }
  if (part.kind === 'solved') return t`Puzzle solved.`;
  if (part.kind === 'revealed') return t`Solution shown.`;
  if (part.kind === 'skipped') return t`Puzzle skipped.`;
  if (part.kind === 'unrated') return t`This attempt was unrated.`;
  return ratingWords(part.delta, part.ratingAfter);
}

export function ChessPuzzleAnnouncement(props: {
  readonly status: Accessor<SolveStatus>;
  readonly moves: Accessor<string>;
  readonly solveIdx: Accessor<number>;
  readonly solverSide: Accessor<PuzzleSide>;
  readonly hintStage: Accessor<HintStage>;
  readonly fen: Accessor<string | null>;
  readonly hintSquare: Accessor<string | null>;
  readonly completion: Accessor<PuzzleCompletion | null>;
}): JSX.Element {
  const words = createMemo(() =>
    puzzleAnnouncement({
      status: props.status(),
      moves: props.moves(),
      solveIdx: props.solveIdx(),
      solverSide: props.solverSide(),
      hintStage: props.hintStage(),
      fen: props.fen(),
      hintSquare: props.hintSquare(),
      completion: props.completion(),
    })
      .map(partWords)
      .join(' ')
  );
  return (
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid={Handles.chessPuzzleAnnouncement}
    >
      {words()}
    </div>
  );
}
