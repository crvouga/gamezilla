import type { PuzzleStats } from '@libs/game-puzzle-shared/stats';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { MetricStrip } from '@pkgs/ui-root-client/metric-strip';
import { Text } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

/** A total, named by test id on the §15 P0 figures so scenarios can read it. */
function StatValue(props: { value: string; testId?: string }): JSX.Element {
  return (
    <Text variant="inherit" testId={props.testId}>
      {props.value}
    </Text>
  );
}

export type PuzzleStatsCardsProps = {
  stats: PuzzleStats;
};

/** The player's totals, as one quiet strip of figures. */
export function PuzzleStatsCards(props: PuzzleStatsCardsProps): JSX.Element {
  return (
    <MetricStrip
      aria-label={t`Puzzle totals`}
      metrics={[
        {
          label: <Trans>Played</Trans>,
          value: (
            <StatValue
              value={String(props.stats.totalPlayed)}
              testId="chess-stats-played"
            />
          ),
        },
        {
          label: <Trans>Solved</Trans>,
          value: (
            <StatValue
              value={String(props.stats.totalSolved)}
              testId="chess-stats-solved"
            />
          ),
        },
        {
          label: <Trans>Accuracy</Trans>,
          value: (
            <StatValue
              value={`${props.stats.accuracy}%`}
              testId="chess-stats-accuracy"
            />
          ),
        },
        {
          label: <Trans>Best streak</Trans>,
          value: <StatValue value={String(props.stats.bestStreak)} />,
        },
        {
          label: <Trans>Streak</Trans>,
          value: <StatValue value={String(props.stats.currentStreak)} />,
        },
      ]}
    />
  );
}
