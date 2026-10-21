/**
 * Chess's live region: the moves the board shows, said in words for someone
 * listening to the app — the setup move and whose move it is, each opponent
 * reply and the piece a hint picks. The results are the platform's region.
 */

import {
  type PuzzleAnnouncementPart,
  type PuzzleSide,
  puzzleAnnouncement,
  spokenPiece,
} from '@libs/chess-puzzle-shared/puzzle-announcement';
import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import { Handles } from '@libs/test-ids-shared/handles';
import { t } from '@lingui/core/macro';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { type Accessor, createMemo, type JSX } from 'solid-js';

function sideWord(side: PuzzleSide): string {
  return side === 'white' ? t`White` : t`Black`;
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
  const side = sideWord(part.side);
  const piece = spokenPiece(part.piece);
  return t`Hint: move the ${side} ${piece} on ${part.square}.`;
}

export function ChessPuzzleAnnouncement(props: {
  readonly status: Accessor<SolveStatus>;
  readonly moves: Accessor<string>;
  readonly solveIdx: Accessor<number>;
  readonly solverSide: Accessor<PuzzleSide>;
  readonly hintStage: Accessor<HintStage>;
  readonly fen: Accessor<string | null>;
  readonly hintSquare: Accessor<string | null>;
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
    })
      .map(partWords)
      .join(' ')
  );
  return (
    <VisuallyHidden
      role="status"
      aria-live="polite"
      aria-atomic
      testId={Handles.chessPuzzleAnnouncement}
    >
      {words()}
    </VisuallyHidden>
  );
}
