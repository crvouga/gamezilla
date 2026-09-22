import { useMyId } from '@libs/auth/public/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ScrollView } from '@pkgs/ui';
import { createMemo, type JSX, Show } from 'solid-js';

import {
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { formatChessPuzzleThemeLabel } from '../chess-puzzle-theme-label';
import { ChessPuzzleRatingChip } from './chess-puzzle-rating-chip';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleFeedPoolStats } from './use-chess-puzzle-feed-pool-stats';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useIsPuzzleAlreadyRated } from './use-chess-puzzle-rating-events';

export type ChessPuzzleFeedBarProps = {
  puzzleId?: string | undefined;
  rating?: number | undefined;
  onOpenFeedSettings: () => void;
};

function historyFilterLabel(filter: ChessPuzzleFeedHistoryFilter): string {
  switch (filter) {
    case 'any':
      return t`Any`;
    case 'neverSeen':
      return t`Unseen`;
    case 'seen':
      return t`Seen`;
    case 'failed':
      return t`Failed`;
  }
}

function themesSummary(themes: readonly string[]): string {
  if (themes.length === 0) return t`All themes`;
  if (themes.length === 1) {
    const first = themes[0];
    return first === undefined
      ? t`All themes`
      : formatChessPuzzleThemeLabel(first);
  }
  return t`${themes.length} themes`;
}

function FeedBarSep(): JSX.Element {
  return <p class="text textCaption shrink-0 text-text-secondary">{'·'}</p>;
}

export function ChessPuzzleFeedBar(
  props: ChessPuzzleFeedBarProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  // §9: an exhausted-pool re-serve is played again but never re-rated (§8).
  const alreadyRated = useIsPuzzleAlreadyRated(() => props.puzzleId ?? '');
  const [config] = useChessPuzzleFeedConfig();
  const pool = useChessPuzzleFeedPoolStats();
  const effectiveRating = createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
  const feedLabel = createMemo(() =>
    config().mode === 'auto' ? (
      <Trans>Auto · {effectiveRating()}</Trans>
    ) : (
      <Trans>Custom · {effectiveRating()}</Trans>
    )
  );
  const showPuzzleRating = () =>
    props.rating !== undefined && (props.rating ?? 0) > 0;
  const puzzleElo = () => (showPuzzleRating() ? (props.rating ?? 0) : 0);
  const idLabel =
    props.puzzleId !== undefined && props.puzzleId.length > 0
      ? props.puzzleId
      : '—';

  return (
    <button
      class="clickable clickableTint self-stretch min-w-0 shrink"
      data-testid="chess-puzzle-feed-summary"
      type="button"
      onClick={props.onOpenFeedSettings}
      role="button"
    >
      <ScrollView
        horizontal
        flushEdge={false}
        hideScrollbar
        class="self-stretch min-w-0"
        contentClass="box flex-row items-center justify-start gap-2 px-3 py-1"
        dataSet={{ testid: 'chess-puzzle-board-elo-bar' }}
      >
        <p class="text textCaption line-clamp-1 shrink-0 text-text-secondary">
          {idLabel}
        </p>
        <Show when={showPuzzleRating()}>
          <FeedBarSep />
          <ChessPuzzleRatingChip
            rating={puzzleElo()}
            variant="muted"
            testID="chess-puzzle-board-elo"
          />
        </Show>
        <Show when={alreadyRated()}>
          <FeedBarSep />
          <p
            class="text textCaption line-clamp-1 shrink-0 text-text-secondary"
            data-testid="chess-puzzle-feed-unrated-label"
          >
            {<Trans>Unrated</Trans>}
          </p>
        </Show>
        <FeedBarSep />
        <p
          class="text textCaption line-clamp-1 shrink-0 text-text-secondary"
          data-testid="chess-puzzle-feed-target-label"
        >
          {feedLabel()}
        </p>
        <FeedBarSep />
        <p
          class="text textCaption line-clamp-1 shrink-0 text-text-secondary"
          data-testid="chess-puzzle-feed-history-label"
        >
          {historyFilterLabel(config().historyFilter)}
        </p>
        <FeedBarSep />
        <p class="text textCaption line-clamp-1 shrink-0 text-text-secondary">
          {themesSummary(config().themes)}
        </p>
        <FeedBarSep />
        <p class="text textCaption line-clamp-1 shrink-0 text-text-secondary">
          {
            <Trans>
              {pool.matched()} / {pool.total()}
            </Trans>
          }
        </p>
      </ScrollView>
    </button>
  );
}
