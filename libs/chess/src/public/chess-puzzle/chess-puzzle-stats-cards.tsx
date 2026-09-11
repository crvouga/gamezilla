import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStats } from '../chess-puzzle-stats';

type StatTileProps = {
  label: JSX.Element;
  value: string;
};

function StatTile(props: StatTileProps): JSX.Element {
  return (
    <div class="box min-w-[0] gap-1 p-3 rounded-[8px] bg-surface-muted">
      <p class="text textCaption line-clamp-1 text-text-secondary">
        {props.label}
      </p>
      <p class="text textBodyBold line-clamp-1 text-text">{props.value}</p>
    </div>
  );
}

export type ChessPuzzleStatsCardsProps = {
  stats: ChessPuzzleStats;
};

export function ChessPuzzleStatsCards(
  props: ChessPuzzleStatsCardsProps
): JSX.Element {
  return (
    <div
      class="box gap-2"
      style={{
        display: 'grid',
        'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
      }}
    >
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
    </div>
  );
}
