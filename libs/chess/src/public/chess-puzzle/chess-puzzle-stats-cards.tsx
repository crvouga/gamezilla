import { Trans } from '@lingui/solid/macro';
import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStats } from '../chess-puzzle-stats';

type StatTileProps = {
  label: JSX.Element;
  value: string;
};

function StatTile(props: StatTileProps): JSX.Element {
  return (
    <Box
      sx={{
        flex: 1,
        gap: 1,
        p: 3,
        borderRadius: 8,
        background: 'surfaceMuted',
      }}
    >
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={props.label}
      />
      <Text variant="bodyBold" sx={{ color: 'text' }} label={props.value} />
    </Box>
  );
}

export type ChessPuzzleStatsCardsProps = {
  stats: ChessPuzzleStats;
};

export function ChessPuzzleStatsCards(
  props: ChessPuzzleStatsCardsProps
): JSX.Element {
  return (
    <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      <StatTile
        label={<Trans>Played</Trans>}
        value={String(props.stats.totalPlayed)}
      />
      <StatTile
        label={<Trans>Solved</Trans>}
        value={String(props.stats.totalSolved)}
      />
      <StatTile
        label={<Trans>Accuracy</Trans>}
        value={`${props.stats.accuracy}%`}
      />
      <StatTile
        label={<Trans>Best streak</Trans>}
        value={String(props.stats.bestStreak)}
      />
      <StatTile
        label={<Trans>Current streak</Trans>}
        value={String(props.stats.currentStreak)}
      />
    </Box>
  );
}
