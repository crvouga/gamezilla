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
 *
 * `requestSolution` sets a pending flag so a one-shot Solution press (wrong
 * mode) promotes to `'solution'` as soon as expected squares arrive.
 */
export type HintStage = 'none' | 'highlight' | 'solution';

export function useHintStage(args: { expectedFromSquare: string | null }): {
  hintStage: HintStage;
  /** Promote `'highlight'` → `'solution'` on the second press. */
  showSolution: () => void;
  /** One-shot: show solution as soon as expected squares are available. */
  requestSolution: () => void;
} {
  const { expectedFromSquare } = args;
  const [solutionShown, setSolutionShown] = useState(false);
  const [pendingSolution, setPendingSolution] = useState(false);

  useEffect(() => {
    if (expectedFromSquare === null) {
      setSolutionShown(false);
      setPendingSolution(false);
      return;
    }
    if (pendingSolution) {
      setSolutionShown(true);
      setPendingSolution(false);
    }
  }, [expectedFromSquare, pendingSolution]);

  const hintStage: HintStage =
    expectedFromSquare === null
      ? 'none'
      : solutionShown
        ? 'solution'
        : 'highlight';

  const showSolution = useCallback(() => setSolutionShown(true), []);

  const requestSolution = useCallback(() => {
    if (expectedFromSquare !== null) {
      setSolutionShown(true);
      return;
    }
    setPendingSolution(true);
  }, [expectedFromSquare]);

  return { hintStage, showSolution, requestSolution };
}
