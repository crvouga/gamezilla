import { useMyId } from '@libs/auth/public/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ScrollView } from '@pkgs/ui';
import { createMemo, type JSX, Show } from 'solid-js';

import {
  type ChessPuzzleFeedConfig,
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { formatChessPuzzleThemeLabel } from '../chess-puzzle-theme-label';
import { useChessPuzzleFeedState } from './chess-puzzle-feed-context';
import { ChessPuzzleRatingChip } from './chess-puzzle-rating-chip';
import { useChessPuzzleFeedPoolStats } from './use-chess-puzzle-feed-pool-stats';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useIsPuzzleAlreadyRated } from './use-chess-puzzle-rating-events';

/** Puzzle ratings are 400–3000: four tabular digits, padded with figure space. */
const RATING_SLOT_DIGITS = 4;

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

function ratingSlot(rating: number): string {
  const digits = String(Math.max(0, Math.round(rating)));
  if (digits.length >= RATING_SLOT_DIGITS) return digits;
  return '\u2007'.repeat(RATING_SLOT_DIGITS - digits.length) + digits;
}

function FeedBarSep(): JSX.Element {
  return (
    <p class="text textCaption shrink-0 whitespace-nowrap text-text-secondary">
      {'·'}
    </p>
  );
}

const LABEL =
  'text textCaption line-clamp-1 shrink-0 whitespace-nowrap text-text-secondary';
const NUMERIC_LABEL = `${LABEL} tabular-nums`;

/**
 * Filter labels paint only after the saved config is in. Until then the
 * id and rating slots already hold their final width, so this block
 * appearing cannot move them or the board below.
 */
function FeedBarFilters(props: {
  config: ChessPuzzleFeedConfig;
  effectiveRating: number;
  matched: number;
  total: number;
}): JSX.Element {
  const modeLabel = (): JSX.Element =>
    props.config.mode === 'auto' ? (
      <Trans>Auto · {ratingSlot(props.effectiveRating)}</Trans>
    ) : (
      <Trans>Custom · {ratingSlot(props.effectiveRating)}</Trans>
    );
  return (
    <>
      <FeedBarSep />
      <p class={NUMERIC_LABEL} data-testid="chess-puzzle-feed-target-label">
        {modeLabel()}
      </p>
      <FeedBarSep />
      <p class={LABEL} data-testid="chess-puzzle-feed-history-label">
        {historyFilterLabel(props.config.historyFilter)}
      </p>
      <FeedBarSep />
      <p class={LABEL}>{themesSummary(props.config.themes)}</p>
      <FeedBarSep />
      <p class={NUMERIC_LABEL}>
        <Trans>
          {props.matched} / {props.total}
        </Trans>
      </p>
    </>
  );
}

export function ChessPuzzleFeedBar(
  props: ChessPuzzleFeedBarProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  // §9: an exhausted-pool re-serve is played again but never re-rated (§8).
  const alreadyRated = useIsPuzzleAlreadyRated(() => props.puzzleId ?? '');
  const feed = useChessPuzzleFeedState();
  const config = feed.config;
  const pool = useChessPuzzleFeedPoolStats();
  const effectiveRating = createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
  const showPuzzleRating = (): boolean =>
    props.rating !== undefined && (props.rating ?? 0) > 0;
  const puzzleRating = (): number =>
    showPuzzleRating() ? (props.rating ?? 0) : 0;
  const idLabel = (): string =>
    props.puzzleId !== undefined && props.puzzleId.length > 0
      ? props.puzzleId
      : '';

  return (
    <button
      class="clickable clickableTint self-stretch min-w-0 shrink-0"
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
        contentClass="box flex-row flex-nowrap items-center justify-start gap-2 px-3 py-1"
        dataSet={{ testid: 'chess-puzzle-board-elo-bar' }}
      >
        {/* Lichess puzzle ids are 5 characters; mono at caption size fits them in w-9, so every id takes the same width. */}
        <p class="text textCaption shrink-0 text-text-secondary w-9 font-mono overflow-hidden whitespace-nowrap">
          {idLabel()}
        </p>
        <FeedBarSep />
        <ChessPuzzleRatingChip
          rating={puzzleRating()}
          variant="muted"
          invisible={!showPuzzleRating()}
          testID="chess-puzzle-board-elo"
        />
        <Show when={alreadyRated()}>
          <FeedBarSep />
          <p class={LABEL} data-testid="chess-puzzle-feed-unrated-label">
            {<Trans>Unrated</Trans>}
          </p>
        </Show>
        <Show when={feed.configReady()}>
          <FeedBarFilters
            config={config()}
            effectiveRating={effectiveRating()}
            matched={pool.matched()}
            total={pool.total()}
          />
        </Show>
      </ScrollView>
    </button>
  );
}
