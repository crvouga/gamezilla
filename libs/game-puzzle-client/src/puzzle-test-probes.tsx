import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import type { JSX } from 'solid-js';
import type { PuzzleAttempt } from './puzzle-client';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';

function watchProbe(attempt: PuzzleAttempt): string {
  return [
    `spectating=${attempt.spectating() ? '1' : '0'}`,
    `role=${attempt.spaceRole()}`,
    `kind=${attempt.statusKind()}`,
    `clock=${attempt.clockElapsedMs() ?? '-'}`,
    `recs=${attempt.suggestionsProbe()}`,
  ].join(' ');
}

/**
 * Hidden probes of the attempt on the board, for every game's scenarios
 * (test builds only, the same gate as the review's): the side the board
 * faces, the solver's next move while they may move,
 * `status|interactive|solveIdx|line|next|hintStage|rating|themes`, the
 * position shown, and who watches with the puzzle clock.
 */
export function PuzzleTestProbes(props: {
  readonly attempt: PuzzleAttempt;
}): JSX.Element {
  if (!PUZZLE_TEST_ENABLED) return <></>;
  const a = props.attempt;
  const next = (): string => a.nextAction() ?? '';
  return (
    <>
      <VisuallyHidden testId="chess-puzzle-board-orientation">
        {a.solverSide()}
      </VisuallyHidden>
      <VisuallyHidden testId="chess-puzzle-expected-uci">
        {a.interactive() ? next() : ''}
      </VisuallyHidden>
      <VisuallyHidden testId="chess-puzzle-test-debug">{`${a.status()}|${a.interactive() ? '1' : '0'}|${a.solveIdx()}|${a.line()}|${next()}|${a.hintStage()}|${a.rating()}|${a.themes().join(',')}`}</VisuallyHidden>
      <VisuallyHidden testId="chess-puzzle-test-fen">
        {a.position() ?? ''}
      </VisuallyHidden>
      <VisuallyHidden testId="chess-puzzle-test-spectator">
        {watchProbe(a)}
      </VisuallyHidden>
    </>
  );
}
