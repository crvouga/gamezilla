import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

const E2E_ENABLED = process.env['EXPO_PUBLIC_E2E'] === '1';

export type ChessPuzzleE2EHintsProps = {
  orientation: 'white' | 'black';
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
};

function buildUci(
  from: string | null,
  to: string | null
): string | null {
  if (from === null || to === null) return null;
  if (from.length === 0 || to.length === 0) return null;
  return `${from}${to}`;
}

export function ChessPuzzleE2EHints({
  orientation,
  expectedFromSquare,
  expectedToSquare,
}: ChessPuzzleE2EHintsProps): ReactNode {
  if (!E2E_ENABLED) return null;
  const uci = buildUci(expectedFromSquare, expectedToSquare);
  return (
    <>
      <Text
        testID="chess-puzzle-board-orientation"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        label={orientation}
      />
      <Text
        testID="chess-puzzle-expected-uci"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        label={uci ?? ''}
      />
    </>
  );
}
