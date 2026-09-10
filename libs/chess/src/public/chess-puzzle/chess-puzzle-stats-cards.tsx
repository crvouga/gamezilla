import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import type { ChessPuzzleStats } from '../chess-puzzle-stats';

type StatTileProps = {
  label: JSX.Element;
  value: string;
};

function StatTile(props: StatTileProps): JSX.Element {
  return (
    <div class="box flex-1 gap-1 p-3 rounded-[8px] bg-surface-muted">
      <p class="text textCaption text-text-secondary">{props.label}</p>
      <p class="text textBodyBold text-text">{props.value}</p>
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
    <div class="box flex-row flex-wrap gap-2">
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
