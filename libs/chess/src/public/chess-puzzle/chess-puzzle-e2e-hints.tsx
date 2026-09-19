import type { Accessor, JSX } from 'solid-js';

import { uciToSquares } from '../chess-puzzle-fsm';

const E2E_ENABLED =
  typeof process !== 'undefined' &&
  (process.env['VITE_E2E'] === '1' || process.env['NODE_ENV'] === 'test');

export type ChessPuzzleE2EHintsProps = {
  orientation: Accessor<'white' | 'black'>;
  status: Accessor<string>;
  solveIdx: Accessor<number>;
  moves: Accessor<string>;
  interactive: Accessor<boolean>;
  solutionUci: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  expectedToSquare: Accessor<string | null>;
  /** Room hint stage (`none` / `highlight` / `solution`). */
  hintStage: Accessor<string>;
  /** Current display FEN so drivers can compute legal (wrong) moves. */
  displayFen: Accessor<string | null>;
  /** Watcher view: no controls, suggestions only. */
  spectating: Accessor<boolean>;
  spaceRole: Accessor<'host' | 'guest' | 'unknown'>;
  statusKind: Accessor<string>;
  clockElapsedMs: Accessor<number | null>;
  /** Current puzzle metadata for deterministic feed assertions. */
  puzzleRating: Accessor<number>;
  themes: Accessor<readonly string[]>;
  /** `by:fromto` pairs, comma separated, oldest first. */
  recommendations: Accessor<string>;
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

function spectatorProbe(props: ChessPuzzleE2EHintsProps): string {
  return [
    `spectating=${props.spectating() ? '1' : '0'}`,
    `role=${props.spaceRole()}`,
    `kind=${props.statusKind()}`,
    `clock=${props.clockElapsedMs() ?? '-'}`,
    `recs=${props.recommendations()}`,
  ].join(' ');
}

export function ChessPuzzleE2EHints(
  props: ChessPuzzleE2EHintsProps
): JSX.Element {
  if (!E2E_ENABLED) return <></>;
  const resolved = (): string | null => resolveSolutionUci(props);
  const uci = (): string | null => (props.interactive() ? resolved() : null);
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
        data-testid="chess-puzzle-board-orientation"
      >
        {props.orientation()}
      </p>
      <p class="text" style={hintStyle} data-testid="chess-puzzle-expected-uci">
        {uci() ?? ''}
      </p>
      <p
        class="text"
        style={hintStyle}
        data-testid="chess-puzzle-e2e-debug"
      >{`${props.status()}|${props.interactive() ? '1' : '0'}|${props.solveIdx()}|${props.moves()}|${resolved() ?? ''}|${props.hintStage()}|${props.puzzleRating()}|${props.themes().join(',')}`}</p>
      <p class="text" style={hintStyle} data-testid="chess-puzzle-e2e-fen">
        {props.displayFen() ?? ''}
      </p>
      <p
        class="text"
        style={hintStyle}
        data-testid="chess-puzzle-e2e-spectator"
      >
        {spectatorProbe(props)}
      </p>
    </>
  );
}
