import type { Accessor, JSX } from 'solid-js';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';

export type PuzzleReviewTestProps = {
  solveIdx: Accessor<number>;
  lastSolveIdx: Accessor<number>;
  /** §7: whether the seek that produced this position animated or snapped. */
  animated: Accessor<boolean>;
  notation: Accessor<string>;
  displayPosition: Accessor<string>;
};

/**
 * Hidden review probe (test builds only, same gate as the play screen's):
 * `<solveIdx>|<lastSolveIdx>|<animated 0|1>|<notation>` plus the position
 * FEN, so a scenario can assert the scrub without reading pixels.
 */
export function PuzzleReviewTest(props: PuzzleReviewTestProps): JSX.Element {
  if (!PUZZLE_TEST_ENABLED) return <></>;
  const hintStyle = {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    opacity: 0.01,
  };
  return (
    <>
      <p
        class="text textBody"
        style={hintStyle}
        data-testid="chess-puzzle-review-test"
      >{`${props.solveIdx()}|${props.lastSolveIdx()}|${props.animated() ? '1' : '0'}|${props.notation()}`}</p>
      <p
        class="text textBody"
        style={hintStyle}
        data-testid="chess-puzzle-review-test-fen"
      >
        {props.displayPosition()}
      </p>
    </>
  );
}
