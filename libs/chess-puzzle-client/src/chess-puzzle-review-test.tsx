import type { ChessMoveNotation } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { CHESS_PUZZLE_TEST_ENABLED } from '@libs/chess-puzzle-shared/chess-puzzle-test-enabled';
import type { Accessor, JSX } from 'solid-js';

export type ChessPuzzleReviewTestProps = {
  solveIdx: Accessor<number>;
  lastSolveIdx: Accessor<number>;
  /** §7: whether the seek that produced this position animated or snapped. */
  animated: Accessor<boolean>;
  notation: Accessor<ChessMoveNotation>;
  displayFen: Accessor<string>;
};

/**
 * Hidden review probe (test builds only, same gate as the play screen's):
 * `<solveIdx>|<lastSolveIdx>|<animated 0|1>|<notation>` plus the position
 * FEN, so a scenario can assert the scrub without reading pixels.
 */
export function ChessPuzzleReviewTest(
  props: ChessPuzzleReviewTestProps
): JSX.Element {
  if (!CHESS_PUZZLE_TEST_ENABLED) return <></>;
  const hintStyle = {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    opacity: 0.01,
  };
  return (
    <>
      <p
        class="text"
        style={hintStyle}
        data-testid="chess-puzzle-review-test"
      >{`${props.solveIdx()}|${props.lastSolveIdx()}|${props.animated() ? '1' : '0'}|${props.notation()}`}</p>
      <p
        class="text"
        style={hintStyle}
        data-testid="chess-puzzle-review-test-fen"
      >
        {props.displayFen()}
      </p>
    </>
  );
}
