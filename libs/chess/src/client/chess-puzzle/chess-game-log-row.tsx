import {
  Box,
  ChevronRightIcon,
  CircleCheckIcon,
  Pressable,
  Text,
  useTheme,
  XIcon,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { ChessPuzzleGameLogEntry } from '../../shared/chess-puzzle-stats';
import { useRelativeTimeLabel } from './use-relative-time-label';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function GameLogTitle({
  solved,
  puzzleRating,
}: {
  solved: boolean;
  puzzleRating: number;
}): ReactNode {
  if (solved) return <Trans>Solved · {puzzleRating}</Trans>;
  return <Trans>Abandoned · {puzzleRating}</Trans>;
}

function GameLogCaption({
  puzzleId,
  timeLabel,
}: {
  puzzleId: string;
  timeLabel: string;
}): ReactNode {
  return (
    <Trans>
      {puzzleId} · {timeLabel}
    </Trans>
  );
}

export type ChessGameLogRowProps = {
  entry: ChessPuzzleGameLogEntry;
  onPress: () => void;
};

export function ChessGameLogRow({
  entry,
  onPress,
}: ChessGameLogRowProps): ReactNode {
  const theme = useTheme();
  const solved = entry.outcome === 'solved';
  const puzzleRating = entry.puzzleRating;
  const timeLabel = useRelativeTimeLabel(entry.at);
  const deltaColor =
    entry.delta > 0
      ? theme.colors.success
      : entry.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;
  const Icon = solved ? CircleCheckIcon : XIcon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID="chess-game-log-row"
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          p: 3,
          borderRadius: 8,
        }}
        style={{ backgroundColor: theme.colors.surfaceMuted }}
      >
        <Icon
          size={18}
          color={solved ? theme.colors.success : theme.colors.destructive}
        />
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text
            variant="bodyBold"
            style={{ color: theme.colors.text }}
            label={<GameLogTitle solved={solved} puzzleRating={puzzleRating} />}
          />
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label={
              <GameLogCaption puzzleId={entry.puzzleId} timeLabel={timeLabel} />
            }
          />
        </Box>
        <Text
          variant="bodyBold"
          style={{ color: deltaColor }}
          label={formatSignedDelta(entry.delta)}
        />
        <ChevronRightIcon size={20} color={theme.colors.icon} />
      </Box>
    </Pressable>
  );
}
