import { Box, Pressable, Text } from '@pkgs/ui';
import { memo, useCallback, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { PuzzleHistoryPly } from '../../shared/chess-puzzle-move-history';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  selected: boolean;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

function MoveNumberLabel(p: {
  moveNumber: number;
  ellipsis: boolean;
}): ReactNode {
  const label = p.ellipsis ? `${p.moveNumber}...` : `${p.moveNumber}.`;
  return (
    <Text
      variant="caption"
      label={label}
      sx={{ color: 'textSecondary', fontWeight: '600', pr: 1 }}
    />
  );
}

/** Show `N.` before White, or `N...` when Black opens a fullmove (common in puzzles). */
export function moveNumberPrefix(
  ply: PuzzleHistoryPly
): { moveNumber: number; ellipsis: boolean } | null {
  if (ply.color === 'w') {
    return { moveNumber: ply.moveNumber, ellipsis: false };
  }
  if (ply.plyIndex === 0) {
    return { moveNumber: ply.moveNumber, ellipsis: true };
  }
  return null;
}

const HistoryPlyChip = memo(function HistoryPlyChip(
  p: HistoryPlyChipProps
): ReactNode {
  const { ply, selected, interactive, onSeek } = p;
  const handlePress = useCallback(() => {
    onSeek(ply.solveIdxAfter);
  }, [onSeek, ply.solveIdxAfter]);
  return (
    <Pressable
      testID={`chess-puzzle-move-ply-${ply.plyIndex}`}
      disabled={!interactive || selected}
      feedback="none"
      onPress={handlePress}
      sx={{
        px: 2,
        py: 1,
        borderRadius: 6,
        background: selected ? 'successSurface' : 'transparent',
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={ply.san}
    >
      <Text
        variant="mono"
        label={ply.san}
        sx={{
          color: selected ? 'success' : 'text',
          fontWeight: selected ? '700' : '600',
        }}
      />
    </Pressable>
  );
});

export function HistoryPlyCluster(p: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  onPlyLayout: (solveIdxAfter: number, event: LayoutChangeEvent) => void;
}): ReactNode {
  const { ply, onPlyLayout } = p;
  const prefix = moveNumberPrefix(ply);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onPlyLayout(ply.solveIdxAfter, event);
    },
    [onPlyLayout, ply.solveIdxAfter]
  );
  return (
    <Box
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
      onLayout={handleLayout}
    >
      {prefix !== null ? (
        <MoveNumberLabel
          moveNumber={prefix.moveNumber}
          ellipsis={prefix.ellipsis}
        />
      ) : null}
      <HistoryPlyChip
        ply={ply}
        selected={ply.solveIdxAfter === p.selectedSolveIdx}
        interactive={p.interactive}
        onSeek={p.onSeek}
      />
    </Box>
  );
}
