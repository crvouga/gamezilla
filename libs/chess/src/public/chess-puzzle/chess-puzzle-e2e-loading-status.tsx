import type { JSX } from 'solid-js';
import { CHESS_PUZZLE_E2E_ENABLED } from './chess-puzzle-e2e-enabled';

export type ChessPuzzleE2ELoadingStatusProps = {
  myId: string;
  nextId: string | null;
  activePuzzleId: string | null;
  bandedCount: number;
  fallbackCount: number;
  poolReady: boolean;
  loading: boolean;
};

function pickStatusLabel(props: ChessPuzzleE2ELoadingStatusProps): string {
  return [
    `myId=${props.myId.length > 0 ? 'set' : 'empty'}`,
    `pick=${props.nextId ?? 'null'}`,
    `active=${props.activePuzzleId ?? 'null'}`,
    `banded=${String(props.bandedCount)}`,
    `fallback=${String(props.fallbackCount)}`,
    `pool=${props.poolReady ? 'ready' : 'pending'}`,
    `loading=${props.loading ? '1' : '0'}`,
  ].join(' ');
}

export function ChessPuzzleE2ELoadingStatus(
  props: ChessPuzzleE2ELoadingStatusProps
): JSX.Element {
  if (!CHESS_PUZZLE_E2E_ENABLED) return <></>;
  return (
    <p
      class="text absolute w-[1px] h-[1px] opacity-0"
      data-testid="chess-puzzle-pick-status"
    >
      {pickStatusLabel(props)}
    </p>
  );
}
