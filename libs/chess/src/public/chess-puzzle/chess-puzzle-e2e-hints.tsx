import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { uciToSquares } from '../chess-puzzle-fsm';

const E2E_ENABLED =
  process.env['EXPO_PUBLIC_E2E'] === '1' || process.env['NODE_ENV'] === 'test';

export type ChessPuzzleE2EHintsProps = {
  orientation: 'white' | 'black';
  status: string;
  solveIdx: number;
  moves: string;
  /** Board accepts human input (frontier + not opponent-animating). */
  interactive: boolean;
  /** Next solution UCI token (human ply). Prefer over hint squares. */
  solutionUci: string | null;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
};

function buildUci(from: string | null, to: string | null): string | null {
  if (from === null || to === null) return null;
  if (from.length === 0 || to.length === 0) return null;
  return `${from}${to}`;
}

function resolveSolutionUci(props: ChessPuzzleE2EHintsProps): string | null {
  const solution = (props.solutionUci ?? '').trim().toLowerCase();
  if (solution.length >= 4 && uciToSquares(solution) !== null) {
    return solution;
  }
  return buildUci(props.expectedFromSquare, props.expectedToSquare);
}

/**
 * Expose orientation + next human UCI for DST / Detox. `chess-puzzle-expected-uci`
 * is blank until the board is interactive so waits cover opponent unlock.
 */
export function ChessPuzzleE2EHints(
  props: ChessPuzzleE2EHintsProps
): ReactNode {
  if (!E2E_ENABLED) return null;
  const { orientation, status, solveIdx, moves, interactive } = props;
  const resolved = resolveSolutionUci(props);
  const uci = interactive ? resolved : null;
  const sx = {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    opacity: 0.01,
  };
  return (
    <>
      <Text
        testID="chess-puzzle-board-orientation"
        sx={sx}
        label={orientation}
      />
      <Text testID="chess-puzzle-expected-uci" sx={sx} label={uci ?? ''} />
      <Text
        testID="chess-puzzle-e2e-debug"
        sx={sx}
        label={`${status}|${interactive ? '1' : '0'}|${solveIdx}|${moves}|${resolved ?? ''}`}
      />
    </>
  );
}
