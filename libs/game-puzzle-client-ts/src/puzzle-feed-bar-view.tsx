import type {
  PuzzleFeedConfig,
  PuzzleFeedHistoryFilter,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { puzzleNamespaceOf } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import { PuzzleRatingBadge } from './puzzle-rating-badge';

/**
 * What the puzzle on the board did to the rating (§8): `'unrated'` for a
 * repeat (§9), the signed change once rated, or null while undecided.
 */
export type PuzzleFeedRatingChange = 'unrated' | number | null;

export type PuzzleFeedBarViewProps = {
  readonly puzzleId?: string | undefined;
  readonly rating?: number | undefined;
  /** The puzzle's themes, shown once the puzzle is over. */
  readonly themes?: readonly string[] | undefined;
  /** The puzzle is over: its own rating and themes may show. */
  readonly over?: boolean | undefined;
  readonly ratingChange: PuzzleFeedRatingChange;
  /** The saved feed settings; the filter tags paint once `configReady`. */
  readonly config: PuzzleFeedConfig;
  readonly configReady: boolean;
  /** The rating the feed targets: the custom one, or profile plus offset. */
  readonly effectiveRating: number;
  /** Puzzles matching the feed, of those synced. */
  readonly matched: number;
  readonly total: number;
  /** Rated puzzles left today; empty when unlimited. */
  readonly allowanceLabel: string;
  /** How the game names a theme. */
  readonly themeLabel: (theme: string) => string;
  readonly onOpenFeedSettings: () => void;
};

/** Puzzle ratings are 400–3000: four tabular digits, padded with figure space. */
const RATING_SLOT_DIGITS = 4;

/** A short puzzle id's width in the mono face, held before the id is known. */
const EMPTY_ID_SLOT = '\u2007'.repeat(5);

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

/** What the puzzle on the board did to the rating: see `ratingChange`. */
function FeedBarRatingChange(props: {
  change: PuzzleFeedRatingChange;
}): JSX.Element {
  const delta = (): number | null =>
    typeof props.change === 'number' ? props.change : null;
  return (
    <>
      <Show when={props.change === 'unrated'}>
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
  themeLabel: ThemeLabel;
}): JSX.Element {
  const themeLabel = (theme: string): string => props.themeLabel(theme);
  const shown = (): boolean => props.over && props.rating > 0;
  return (
    <>
      <PuzzleRatingBadge
        rating={shown() ? props.rating : 0}
        invisible={!shown()}
        prefix={t`Puzzle rating`}
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
  themeLabel: ThemeLabel;
}): JSX.Element {
  const themeLabel = (theme: string): string => props.themeLabel(theme);
  const modeLabel = (): JSX.Element =>
    props.config.mode === 'auto' ? (
      <Trans>Auto target {ratingSlot(props.effectiveRating)}</Trans>
    ) : (
      <Trans>Custom target {ratingSlot(props.effectiveRating)}</Trans>
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
            {props.matched} of {props.total} puzzles
          </Trans>
        }
      />
    </>
  );
}

/**
 * The feed strip above the board, presentational: the puzzle by name, its
 * own rating and themes once over and the rating change it made, its id
 * trailing quietly; under them the feed's filters and the rated allowance.
 * Pressing it opens the feed settings.
 */
export function PuzzleFeedBarView(props: PuzzleFeedBarViewProps): JSX.Element {
  const themeLabel = (theme: string): string => props.themeLabel(theme);
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
        {`${feedAccessibleLabel(props.config, props.effectiveRating, themeLabel)} ${props.allowanceLabel}`.trim()}
      </VisuallyHidden>
      <StackVertical
        self="stretch"
        gap="xs"
        paddingX="lg"
        paddingY="sm"
        testId="chess-puzzle-board-elo-bar"
      >
        {/* The puzzle first, by name; what it did once it is over. */}
        <StackHorizontal self="stretch" align="center" gap="sm">
          <StackHorizontal wrap grow align="center" gap="sm">
            <P variant="bodyBold" wrap="nowrap">
              <Trans>Puzzle</Trans>
            </P>
            <FeedBarPuzzleFacts
              rating={props.rating ?? 0}
              themes={props.themes ?? []}
              over={props.over === true}
              themeLabel={themeLabel}
            />
            {/* §9: a re-serve is played again but never re-rated (§8). */}
            <FeedBarRatingChange change={props.ratingChange} />
          </StackHorizontal>
          {/* The id is for reference, so it trails, quiet; a fixed slot
              keeps every short id the same width. */}
          <P variant="mono" tone="secondary" wrap="nowrap">
            {idLabel().length > 0 ? `#${idLabel()}` : EMPTY_ID_SLOT}
          </P>
          <SlidersHorizontalIcon size={18} color="icon" />
        </StackHorizontal>
        {/* The feed's filters, each its own tag; wraps rather than
            scrolls, so every fact stays in view on a phone. */}
        <StackHorizontal wrap self="stretch" align="center" gap="xs">
          <Show when={props.configReady}>
            <FeedBarFilters
              config={props.config}
              effectiveRating={props.effectiveRating}
              matched={props.matched}
              total={props.total}
              themeLabel={themeLabel}
            />
          </Show>
          <Show when={props.allowanceLabel.length > 0}>
            <FeedTag
              label={props.allowanceLabel}
              testId="chess-puzzle-remaining-today"
            />
          </Show>
        </StackHorizontal>
      </StackVertical>
    </Pressable>
  );
}
