import { Box, Text, useTheme } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { ChessPuzzleStats } from '../../shared/chess-puzzle-stats';

type StatTileProps = {
  label: ReactNode;
  value: string;
};

function StatTile({ label, value }: StatTileProps): ReactNode {
  const theme = useTheme();
  return (
    <Box
      sx={{ flex: 1, gap: 1, p: 3, borderRadius: 8 }}
      style={{ backgroundColor: theme.colors.surfaceMuted }}
    >
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary }}
        label={label}
      />
      <Text
        variant="bodyBold"
        style={{ color: theme.colors.text }}
        label={value}
      />
    </Box>
  );
}

export type ChessPuzzleStatsCardsProps = {
  stats: ChessPuzzleStats;
};

export function ChessPuzzleStatsCards({
  stats,
}: ChessPuzzleStatsCardsProps): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      <StatTile
        label={<Trans>Played</Trans>}
        value={String(stats.totalPlayed)}
      />
      <StatTile
        label={<Trans>Solved</Trans>}
        value={String(stats.totalSolved)}
      />
      <StatTile label={<Trans>Accuracy</Trans>} value={`${stats.accuracy}%`} />
      <StatTile
        label={<Trans>Best streak</Trans>}
        value={String(stats.bestStreak)}
      />
      <StatTile
        label={<Trans>Current streak</Trans>}
        value={String(stats.currentStreak)}
      />
    </Box>
  );
}
