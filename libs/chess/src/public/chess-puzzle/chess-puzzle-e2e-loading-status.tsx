import type { JSX } from 'solid-js';

const E2E_ENABLED =
  typeof process !== 'undefined' &&
  (process.env['VITE_E2E'] === '1' || process.env['NODE_ENV'] === 'test');

export type ChessPuzzleE2ELoadingStatusProps = {
  myId: string;
  nextId: string | null;
  activePuzzleId: string | null;
  bandedCount: number;
  fallbackCount: number;
  replayCount: number;
  loading: boolean;
};

function pickStatusLabel(props: ChessPuzzleE2ELoadingStatusProps): string {
  return [
    `myId=${props.myId.length > 0 ? 'set' : 'empty'}`,
    `pick=${props.nextId ?? 'null'}`,
    `active=${props.activePuzzleId ?? 'null'}`,
    `banded=${String(props.bandedCount)}`,
    `fallback=${String(props.fallbackCount)}`,
    `replay=${String(props.replayCount)}`,
    `loading=${props.loading ? '1' : '0'}`,
  ].join(' ');
}

export function ChessPuzzleE2ELoadingStatus(
  props: ChessPuzzleE2ELoadingStatusProps
): JSX.Element {
  if (!E2E_ENABLED) return <></>;
  return (
    <p
      class="text absolute w-[1px] h-[1px] opacity-0"
      data-testid="chess-puzzle-pick-status"
    >
      {pickStatusLabel(props)}
    </p>
  );
}
