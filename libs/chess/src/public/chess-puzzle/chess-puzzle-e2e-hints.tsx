import { Text } from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';

import { uciToSquares } from '../chess-puzzle-fsm';

const E2E_ENABLED =
  process.env['EXPO_PUBLIC_E2E'] === '1' || process.env['NODE_ENV'] === 'test';

export type ChessPuzzleE2EHintsProps = {
  orientation: Accessor<'white' | 'black'>;
  status: Accessor<string>;
  solveIdx: Accessor<number>;
  moves: Accessor<string>;
  interactive: Accessor<boolean>;
  solutionUci: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  expectedToSquare: Accessor<string | null>;
};

function buildUci(from: string | null, to: string | null): string | null {
  if (from === null || to === null) return null;
  if (from.length === 0 || to.length === 0) return null;
  return `${from}${to}`;
}

function resolveSolutionUci(props: ChessPuzzleE2EHintsProps): string | null {
  const solution = (props.solutionUci() ?? '').trim().toLowerCase();
  if (solution.length >= 4 && uciToSquares(solution) !== null) {
    return solution;
  }
  return buildUci(props.expectedFromSquare(), props.expectedToSquare());
}

export function ChessPuzzleE2EHints(
  props: ChessPuzzleE2EHintsProps
): JSX.Element {
  if (!E2E_ENABLED) return <></>;
  const resolved = (): string | null => resolveSolutionUci(props);
  const uci = (): string | null => (props.interactive() ? resolved() : null);
  const sx = {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    opacity: 0.01,
  };
  return (
    <>
      <Text
        dataSet={{ testid: 'chess-puzzle-board-orientation' }}
        sx={sx}
        label={props.orientation()}
      />
      <Text
        dataSet={{ testid: 'chess-puzzle-expected-uci' }}
        sx={sx}
        label={uci() ?? ''}
      />
      <Text
        dataSet={{ testid: 'chess-puzzle-e2e-debug' }}
        sx={sx}
        label={`${props.status()}|${props.interactive() ? '1' : '0'}|${props.solveIdx()}|${props.moves()}|${resolved() ?? ''}`}
      />
    </>
  );
}
