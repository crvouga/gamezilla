/**
 * The platform's live region about a puzzle attempt's results, for every
 * game: a wrong move, the solve, the solution shown or a skip, and the
 * rating change, said in words for someone listening to the app.
 */

import type { PuzzleResultPart } from '@libs/game-puzzle-shared-ts/puzzle-result-announcement';
import { puzzleResultAnnouncement } from '@libs/game-puzzle-shared-ts/puzzle-result-announcement';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, type JSX } from 'solid-js';
import type { PuzzleAttempt } from './puzzle-client';

function ratingWords(delta: number, after: number): string {
  if (delta > 0) return t`Your puzzle rating went up by ${delta}, to ${after}.`;
  if (delta < 0) {
    const down = -delta;
    return t`Your puzzle rating went down by ${down}, to ${after}.`;
  }
  return t`Your puzzle rating stayed at ${after}.`;
}

function partWords(part: PuzzleResultPart): string {
  if (part.kind === 'wrong') return t`Wrong move. That is not the solution.`;
  if (part.kind === 'solved') return t`Puzzle solved.`;
  if (part.kind === 'revealed') return t`Solution shown.`;
  if (part.kind === 'skipped') return t`Puzzle skipped.`;
  if (part.kind === 'unrated') return t`This attempt was unrated.`;
  return ratingWords(part.delta, part.ratingAfter);
}

export function PuzzleResultAnnouncement(props: {
  readonly attempt: PuzzleAttempt;
}): JSX.Element {
  const words = createMemo(() =>
    puzzleResultAnnouncement({
      status: props.attempt.status(),
      completion: props.attempt.completion(),
    })
      .map(partWords)
      .join(' ')
  );
  return (
    <VisuallyHidden
      role="status"
      aria-live="polite"
      aria-atomic
      testId={Handles.puzzleResultAnnouncement}
    >
      {words()}
    </VisuallyHidden>
  );
}
