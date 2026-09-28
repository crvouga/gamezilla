import type { JSX } from 'solid-js';
import type { PuzzlePickSource } from '../../shared/puzzle-session/next-puzzle-selection';
import type { PuzzlePickState } from '../../shared/puzzle-session/pick-state';
import { CHESS_PUZZLE_TEST_ENABLED } from './chess-puzzle-test-enabled';

export type ChessPuzzleTestLoadingStatusProps = {
  myId: string;
  nextId: string | null;
  activePuzzleId: string | null;
  pickState: PuzzlePickState;
  bandedCount: number;
  fallbackCount: number;
  poolReady: boolean;
  loading: boolean;
  /** §9 half-window the pick used (widens with RD). */
  halfWindow: number;
  /** Where the pick came from: `unseen` / `widened` / `exhausted`. */
  source: PuzzlePickSource | null;
  /** False once this puzzle has already moved the rating (§8 / §9). */
  rated: boolean;
};

function pickStatusLabel(props: ChessPuzzleTestLoadingStatusProps): string {
  return [
    `pick=${props.nextId ?? 'null'}`,
    `pickState=${props.pickState}`,
    `active=${props.activePuzzleId ?? 'null'}`,
    `banded=${String(props.bandedCount)}`,
    `fallback=${String(props.fallbackCount)}`,
    `pool=${props.poolReady ? 'ready' : 'pending'}`,
    `loading=${props.loading ? '1' : '0'}`,
    `window=${String(props.halfWindow)}`,
    `source=${props.source ?? 'none'}`,
    `rated=${props.rated ? '1' : '0'}`,
  ].join(' ');
}

export function ChessPuzzleTestLoadingStatus(
  props: ChessPuzzleTestLoadingStatusProps
): JSX.Element {
  if (!CHESS_PUZZLE_TEST_ENABLED) return <></>;
  return (
    <p
      class="text absolute w-0.25 h-0.25 opacity-0"
      data-testid="chess-puzzle-pick-status"
    >
      {pickStatusLabel(props)}
    </p>
  );
}
