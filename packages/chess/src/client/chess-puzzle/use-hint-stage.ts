import { useCallback, useEffect, useState } from 'react';

/**
 * Two-step hint reveal:
 *
 *   - `'none'`: no hint requested for this attempt. The hint button shows
 *     "Hint" and dispatches the server hint request on press.
 *   - `'highlight'`: server has returned the expected from/to squares, so the
 *     board pulses a dot on the from-square. The hint button now shows
 *     "Solution" and the next press flips us to `'solution'` locally — no
 *     additional server round-trip.
 *   - `'solution'`: the board renders the full from→to arrow.
 *
 * The local `solutionShown` flag is auto-reset whenever the server clears
 * `expectedFromSquare` (move accepted, reset, new puzzle started) so each
 * attempt starts fresh at `'none'`.
 */
export type HintStage = 'none' | 'highlight' | 'solution';

export function useHintStage(args: {
  expectedFromSquare: string | null;
}): {
  hintStage: HintStage;
  /** Promote `'highlight'` → `'solution'` on the second press. */
  showSolution: () => void;
} {
  const { expectedFromSquare } = args;
  const [solutionShown, setSolutionShown] = useState(false);

  useEffect(() => {
    if (expectedFromSquare === null) setSolutionShown(false);
  }, [expectedFromSquare]);

  const hintStage: HintStage =
    expectedFromSquare === null
      ? 'none'
      : solutionShown
        ? 'solution'
        : 'highlight';

  const showSolution = useCallback(() => setSolutionShown(true), []);
  return { hintStage, showSolution };
}
