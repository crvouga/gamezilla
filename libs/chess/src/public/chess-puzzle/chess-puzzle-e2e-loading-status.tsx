import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

const E2E_ENABLED = process.env['EXPO_PUBLIC_E2E'] === '1';

export type ChessPuzzleE2ELoadingStatusProps = {
  myId: string;
  nextId: string | null;
  activePuzzleId: string | null;
  bandedCount: number;
  fallbackCount: number;
  replayCount: number;
  loading: boolean;
};

export function ChessPuzzleE2ELoadingStatus(
  props: ChessPuzzleE2ELoadingStatusProps
): ReactNode {
  if (!E2E_ENABLED) return null;
  const label = [
    `myId=${props.myId.length > 0 ? 'set' : 'empty'}`,
    `pick=${props.nextId ?? 'null'}`,
    `active=${props.activePuzzleId ?? 'null'}`,
    `banded=${String(props.bandedCount)}`,
    `fallback=${String(props.fallbackCount)}`,
    `replay=${String(props.replayCount)}`,
    `loading=${props.loading ? '1' : '0'}`,
  ].join(' ');
  return (
    <Text
      testID="chess-puzzle-pick-status"
      sx={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      label={label}
    />
  );
}
