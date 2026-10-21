import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  PuzzleFeedConfig,
  PuzzleFeedHistoryFilter,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { resolveEffectivePuzzleRating } from '@libs/game-puzzle-shared-ts/feed-config';
import { puzzleNamespaceOf } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { derivePuzzleRatingChange } from '@libs/game-puzzle-shared-ts/rating-change';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, type JSX, Show } from 'solid-js';
import { usePuzzleFeedState } from './puzzle-feed-context';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleInteractions } from './puzzle-play-queries';
import { PuzzleRatingBadge } from './puzzle-rating-badge';
import { usePuzzleAllowance } from './use-puzzle-allowance';
import { usePuzzleFeedPoolStats } from './use-puzzle-feed-pool-stats';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingEvents } from './use-puzzle-rating-events';

/** Puzzle ratings are 400–3000: four tabular digits, padded with figure space. */
const RATING_SLOT_DIGITS = 4;

/** A short puzzle id's width in the mono face, held before the id is known. */
const EMPTY_ID_SLOT = '\u2007'.repeat(5);

export type PuzzleFeedBarProps = {
  puzzleId?: string | undefined;
  rating?: number | undefined;
  /** The puzzle's themes, shown once the puzzle is over. */
  themes?: readonly string[] | undefined;
  /** The puzzle is over: its own rating and themes may show. */
  over?: boolean | undefined;
  onOpenFeedSettings: () => void;
};

function historyFilterLabel(filter: PuzzleFeedHistoryFilter): string {
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

type ThemeLabel = (theme: string) => string;

/** How the game names a theme; its stored key when the game names none. */
function useThemeLabel(): ThemeLabel {
  const { client } = usePuzzleGame();
  return client.themes?.label ?? ((theme) => theme);
}

function themesSummary(
  themes: readonly string[],
  themeLabel: ThemeLabel
): string {
  if (themes.length === 0) return t`All themes`;
  if (themes.length === 1) {
    const first = themes[0];
    return first === undefined ? t`All themes` : themeLabel(first);
  }
  return t`${themes.length} themes`;
}

function feedAccessibleLabel(
  config: PuzzleFeedConfig,
  rating: number,
  themeLabel: ThemeLabel
): string {
  const mode = config.mode === 'auto' ? t`Automatic` : t`Custom`;
  const history = historyFilterLabel(config.historyFilter);
  const themes = themesSummary(config.themes, themeLabel);
  const advance =
    config.autoAdvance === 'off'
      ? t`Manual next puzzle`
      : config.autoAdvance === 'after1s'
        ? t`Next puzzle after one second`
        : t`Next puzzle immediately`;
  return t`Puzzle feed. ${mode} target ${rating}. History: ${history}. Themes: ${themes}. ${advance}.`;
}

function ratingSlot(rating: number): string {
  const digits = String(Math.max(0, Math.round(rating)));
  if (digits.length >= RATING_SLOT_DIGITS) return digits;
  return '\u2007'.repeat(RATING_SLOT_DIGITS - digits.length) + digits;
}

/** Each fact is its own quiet tag, so the strip needs no separators. */
function FeedTag(props: { label: JSX.Element; testId?: string }): JSX.Element {
  return (
    <Badge
      intent="neutral"
      label={props.label}
      dataSet={
        props.testId === undefined ? undefined : { testid: props.testId }
      }
    />
  );
}

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * What the puzzle on the board did to the rating (§8): this play's rating
 * change once its outcome is decided, or "Unrated" for a repeat (§9).
 */
function FeedBarRatingChange(props: { puzzleId: string }): JSX.Element {
  const events = usePuzzleRatingEvents();
  const interactions = usePuzzleInteractions(() => props.puzzleId);
  const change = createMemo(() =>
    derivePuzzleRatingChange({
      puzzleId: props.puzzleId,
      interactions: interactions.rows(),
      ratingEvents: events(),
    })
  );
  const delta = (): number | null => {
    const current = change();
    return current.kind === 'rated' ? current.delta : null;
  };
  return (
    <>
      <Show when={change().kind === 'unrated'}>
        <FeedTag
          label={<Trans>Unrated</Trans>}
          testId="chess-puzzle-feed-unrated-label"
        />
      </Show>
      <Show when={delta()} keyed>
        {(value) => (
          <FeedTag
            label={formatSignedDelta(value)}
            testId="chess-puzzle-feed-rating-change"
          />
        )}
      </Show>
    </>
  );
}

/** The puzzle's own rating and themes: hidden until the puzzle is over. */
function FeedBarPuzzleFacts(props: {
  rating: number;
  themes: readonly string[];
  over: boolean;
}): JSX.Element {
  const themeLabel = useThemeLabel();
  const shown = (): boolean => props.over && props.rating > 0;
  return (
    <>
      <PuzzleRatingBadge
        rating={shown() ? props.rating : 0}
        invisible={!shown()}
        testId="chess-puzzle-board-elo"
      />
      <Show when={props.over && props.themes.length > 0}>
        <FeedTag
          label={props.themes.map(themeLabel).join(', ')}
          testId="chess-puzzle-feed-puzzle-themes"
        />
      </Show>
    </>
  );
}

/**
 * Filter labels paint only after the saved config is in. Until then the
 * id and rating slots already hold their final width, so this block
 * appearing cannot move them or the board below.
 */
function FeedBarFilters(props: {
  config: PuzzleFeedConfig;
  effectiveRating: number;
  matched: number;
  total: number;
}): JSX.Element {
  const themeLabel = useThemeLabel();
  const modeLabel = (): JSX.Element =>
    props.config.mode === 'auto' ? (
      <Trans>Auto · {ratingSlot(props.effectiveRating)}</Trans>
    ) : (
      <Trans>Custom · {ratingSlot(props.effectiveRating)}</Trans>
    );
  return (
    <>
      <FeedTag label={modeLabel()} testId="chess-puzzle-feed-target-label" />
      <FeedTag
        label={historyFilterLabel(props.config.historyFilter)}
        testId="chess-puzzle-feed-history-label"
      />
      <FeedTag
        label={themesSummary(props.config.themes, themeLabel)}
        testId="chess-puzzle-feed-themes-label"
      />
      <FeedTag
        label={
          <Trans>
            {props.matched} / {props.total}
          </Trans>
        }
      />
    </>
  );
}

export function PuzzleFeedBar(props: PuzzleFeedBarProps): JSX.Element {
  const myId = useMyId();
  const allowance = usePuzzleAllowance();
  const { profileRating } = usePuzzleProfileRatings(myId);
  const feed = usePuzzleFeedState();
  const config = feed.config;
  const pool = usePuzzleFeedPoolStats(config);
  const effectiveRating = createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
  const themeLabel = useThemeLabel();
  // The game's own id for the puzzle: its namespace goes without saying.
  const idLabel = (): string =>
    props.puzzleId !== undefined && props.puzzleId.length > 0
      ? props.puzzleId.slice(puzzleNamespaceOf(props.puzzleId).length)
      : '';

  return (
    <Pressable
      self="stretch"
      testId="chess-puzzle-feed-summary"
      onPress={props.onOpenFeedSettings}
    >
      {/* The whole feed in words; the visible labels follow it, so the
          button's name says everything the bar shows (WCAG 2.5.3). */}
      <VisuallyHidden testId="chess-puzzle-feed-description">
        {`${feedAccessibleLabel(config(), effectiveRating(), themeLabel)} ${allowance.label()}`.trim()}
      </VisuallyHidden>
      <ScrollView
        horizontal
        flushEdge={false}
        hideScrollbar
        self="stretch"
        align="center"
        gap="sm"
        paddingX="lg"
        paddingY="sm"
        dataSet={{ testid: 'chess-puzzle-board-elo-bar' }}
      >
        {/* A fixed slot keeps every short puzzle id the same width. */}
        <P variant="mono" wrap="nowrap">
          {idLabel().length > 0 ? idLabel() : EMPTY_ID_SLOT}
        </P>
        <FeedBarPuzzleFacts
          rating={props.rating ?? 0}
          themes={props.themes ?? []}
          over={props.over === true}
        />
        {/* §9: a re-serve is played again but never re-rated (§8). */}
        <FeedBarRatingChange puzzleId={props.puzzleId ?? ''} />
        <Show when={feed.configReady()}>
          <FeedBarFilters
            config={config()}
            effectiveRating={effectiveRating()}
            matched={pool.matched()}
            total={pool.total()}
          />
        </Show>
        <Show when={allowance.remaining() !== null}>
          <FeedTag
            label={allowance.label()}
            testId="chess-puzzle-remaining-today"
          />
        </Show>
      </ScrollView>
    </Pressable>
  );
}
