import type { ChessPuzzleStats } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

type StatTileProps = {
  label: JSX.Element;
  value: string;
  /** Set on the §15 P0 figures so scenarios can read them by name. */
  testId?: string;
};

function StatTile(props: StatTileProps): JSX.Element {
  return (
    <div class="box min-w-0 gap-1">
      <p class="text textCaption line-clamp-1">{props.label}</p>
      <p
        class="text textSubtitle textNumeral line-clamp-1"
        data-testid={props.testId}
      >
        {props.value}
      </p>
    </div>
  );
}

export type ChessPuzzleStatsCardsProps = {
  stats: ChessPuzzleStats;
};

/** The player's totals, in one panel like every other group on the screen. */
export function ChessPuzzleStatsCards(
  props: ChessPuzzleStatsCardsProps
): JSX.Element {
  return (
    <div class="card grid grid-cols-3 gap-x-4 gap-y-5 p-4">
      <StatTile
        label={<Trans>Played</Trans>}
        value={String(props.stats.totalPlayed)}
        testId="chess-stats-played"
      />
      <StatTile
        label={<Trans>Solved</Trans>}
        value={String(props.stats.totalSolved)}
        testId="chess-stats-solved"
      />
      <StatTile
        label={<Trans>Accuracy</Trans>}
        value={`${props.stats.accuracy}%`}
        testId="chess-stats-accuracy"
      />
      <StatTile
        label={<Trans>Best streak</Trans>}
        value={String(props.stats.bestStreak)}
      />
      <StatTile
        label={<Trans>Streak</Trans>}
        value={String(props.stats.currentStreak)}
      />
    </div>
  );
}
