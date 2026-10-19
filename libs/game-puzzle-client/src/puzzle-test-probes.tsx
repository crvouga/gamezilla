import type { JSX } from 'solid-js';
import type { PuzzleAttempt } from './puzzle-client';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';

const HIDDEN = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  opacity: 0.01,
};

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
      <p
        class="text textBody"
        style={HIDDEN}
        data-testid="chess-puzzle-board-orientation"
      >
        {a.solverSide()}
      </p>
      <p
        class="text textBody"
        style={HIDDEN}
        data-testid="chess-puzzle-expected-uci"
      >
        {a.interactive() ? next() : ''}
      </p>
      <p
        class="text textBody"
        style={HIDDEN}
        data-testid="chess-puzzle-test-debug"
      >{`${a.status()}|${a.interactive() ? '1' : '0'}|${a.solveIdx()}|${a.line()}|${next()}|${a.hintStage()}|${a.rating()}|${a.themes().join(',')}`}</p>
      <p
        class="text textBody"
        style={HIDDEN}
        data-testid="chess-puzzle-test-fen"
      >
        {a.position() ?? ''}
      </p>
      <p
        class="text textBody"
        style={HIDDEN}
        data-testid="chess-puzzle-test-spectator"
      >
        {watchProbe(a)}
      </p>
    </>
  );
}
