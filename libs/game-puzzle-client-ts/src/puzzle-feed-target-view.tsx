import type { PuzzleFeedMode } from '@libs/game-puzzle-shared-ts/feed-config';
import {
  clampPuzzleFeedAutoOffset,
  clampPuzzleFeedRating,
  PUZZLE_FEED_AUTO_OFFSET_MAX,
  PUZZLE_FEED_AUTO_OFFSET_MIN,
  PUZZLE_FEED_AUTO_OFFSET_STEP,
  PUZZLE_FEED_RATING_MAX,
  PUZZLE_FEED_RATING_MIN,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

/** The custom target moves in steps of this many rating points. */
const CUSTOM_RATING_STEP = 50;

/** How the target is found: from the player's rating, or fixed. */
function TargetMode(props: PuzzlePlayScreenViewProps): JSX.Element {
  const rating = (): string =>
    props.feed.profileRating > 0 ? String(props.feed.profileRating) : '—';
  const choose = (mode: PuzzleFeedMode): void => props.feed.onChange({ mode });
  return (
    <MenuSection title={<Trans>Difficulty</Trans>}>
      <MenuRow
        title={<Trans>Automatic</Trans>}
        caption={<Trans>Your rating ({rating()}), plus an offset.</Trans>}
        selected={props.feed.draft.mode === 'auto'}
        hideChevron
        onClick={() => choose('auto')}
        dataSet={{ testid: Handles.chessPuzzleFeedModeSegment('auto') }}
      />
      <MenuRow
        title={<Trans>Custom</Trans>}
        caption={<Trans>A fixed rating you choose.</Trans>}
        selected={props.feed.draft.mode === 'custom'}
        hideChevron
        onClick={() => choose('custom')}
        dataSet={{ testid: Handles.chessPuzzleFeedModeSegment('custom') }}
      />
    </MenuSection>
  );
}

/**
 * The stepper of the chosen mode. Each branch is its own `<Show>` child, so
 * changing the mode swaps the stepper live.
 */
function TargetStepper(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Show
      when={props.feed.draft.mode === 'auto'}
      fallback={
        <NumberStepper
          label={t`Target rating`}
          value={props.feed.draft.customRating}
          onChange={(rating) =>
            props.feed.onChange({ customRating: clampPuzzleFeedRating(rating) })
          }
          min={PUZZLE_FEED_RATING_MIN}
          max={PUZZLE_FEED_RATING_MAX}
          step={CUSTOM_RATING_STEP}
          dataSet={{ testid: 'chess-puzzle-feed-custom-rating' }}
        />
      }
    >
      <StackVertical gap="sm">
        <NumberStepper
          label={t`Rating offset`}
          value={props.feed.draft.autoOffset}
          onChange={(offset) =>
            props.feed.onChange({
              autoOffset: clampPuzzleFeedAutoOffset(offset),
            })
          }
          min={PUZZLE_FEED_AUTO_OFFSET_MIN}
          max={PUZZLE_FEED_AUTO_OFFSET_MAX}
          step={PUZZLE_FEED_AUTO_OFFSET_STEP}
          dataSet={{ testid: 'chess-puzzle-feed-offset' }}
        />
        <P variant="caption" testId={Handles.chessPuzzleFeedTarget}>
          <Trans>Target rating: {props.feed.draftTarget}</Trans>
        </P>
      </StackVertical>
    </Show>
  );
}

/**
 * The `feed-target` place: the rating the feed aims at. Automatic follows
 * the player's own rating by an offset; custom is a fixed rating. The
 * choice goes to the draft the settings save.
 */
export function PuzzleFeedTargetView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-feed-target"
      title={<Trans>Target rating</Trans>}
    >
      <StackVertical gap="xl">
        <TargetMode {...props} />
        <TargetStepper {...props} />
        <StackHorizontal>
          <Button
            title={<Trans>Back to settings</Trans>}
            intent="neutral"
            variant="outline"
            onClick={() => props.onBack()}
            dataSet={{ testid: 'chess-puzzle-feed-target-done' }}
          />
        </StackHorizontal>
      </StackVertical>
    </EmbeddedScreen>
  );
}
