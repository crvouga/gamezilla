import { Box, Clickable, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { PuzzleHistoryPly } from '../chess-puzzle-move-history';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  selected: boolean;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

function MoveNumberLabel(props: {
  moveNumber: number;
  ellipsis: boolean;
}): JSX.Element {
  const label = props.ellipsis
    ? `${props.moveNumber}...`
    : `${props.moveNumber}.`;
  return (
    <Text
      variant="caption"
      label={label}
      sx={{ color: 'textSecondary', fontWeight: '600', pr: 1 }}
    />
  );
}

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

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  const handlePress = (): void => {
    props.onSeek(props.ply.solveIdxAfter);
  };
  return (
    <Clickable
      dataSet={{ testid: `chess-puzzle-move-ply-${props.ply.plyIndex}` }}
      disabled={!props.interactive || props.selected}
      feedback="none"
      onClick={handlePress}
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 4,
        background: props.selected ? 'successSurface' : 'transparent',
      }}
      role="button"
      aria-pressed={props.selected}
      aria-label={props.ply.san}
    >
      <Text
        variant="mono"
        label={props.ply.san}
        sx={{
          color: props.selected ? 'success' : 'text',
          fontWeight: props.selected ? '700' : '600',
        }}
      />
    </Clickable>
  );
}

export function HistoryPlyCluster(props: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  selectedRef?: (el: HTMLElement) => void;
}): JSX.Element {
  const prefix = moveNumberPrefix(props.ply);
  return (
    <Box
      ref={props.selectedRef}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {prefix !== null ? (
        <MoveNumberLabel
          moveNumber={prefix.moveNumber}
          ellipsis={prefix.ellipsis}
        />
      ) : null}
      <HistoryPlyChip
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
        interactive={props.interactive}
        onSeek={props.onSeek}
      />
    </Box>
  );
}
