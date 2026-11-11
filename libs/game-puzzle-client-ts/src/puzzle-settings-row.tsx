import { Trans } from '@lingui/solid/macro';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import {
  feedAccessibleLabel,
  historyFilterLabel,
  targetLabel,
  themesSummary,
} from './puzzle-feed-words';
import type { PuzzleFeedSettingsModel } from './puzzle-play-screen-model';

/** Between the facts of the row's one line. */
const SEPARATOR = ' · ';

export type PuzzleSettingsRowProps = {
  readonly feed: PuzzleFeedSettingsModel;
  /** Rated puzzles left today; empty when unlimited. */
  readonly allowanceLabel: string;
  readonly onOpen: () => void;
};

/**
 * What the saved feed serves, as one quiet line ("Auto target 1500 ·
 * Unseen · All themes"), then the rated puzzles left today. The filter
 * words paint only once the saved settings are in; until then the line
 * keeps its height, so their arriving cannot move the row.
 */
function ServedLine(props: PuzzleSettingsRowProps): JSX.Element {
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  return (
    <>
      <Show when={props.feed.savedReady} fallback={' '}>
        <Text variant="inherit" testId="chess-puzzle-feed-target-label">
          {targetLabel(props.feed.saved, props.feed.savedTarget)}
        </Text>
        {SEPARATOR}
        <Text variant="inherit" testId="chess-puzzle-feed-history-label">
          {historyFilterLabel(props.feed.saved.historyFilter)}
        </Text>
        {SEPARATOR}
        <Text variant="inherit" testId="chess-puzzle-feed-themes-label">
          {themesSummary(props.feed.saved.themes, themeLabel)}
        </Text>
      </Show>
      <Show when={props.allowanceLabel.length > 0}>
        <Show when={props.feed.savedReady}>{SEPARATOR}</Show>
        <Text variant="inherit" testId="chess-puzzle-remaining-today">
          {props.allowanceLabel}
        </Text>
      </Show>
    </>
  );
}

/** The saved feed in one sentence, as the puzzle settings are described. */
export function savedFeedSpoken(feed: PuzzleFeedSettingsModel): string {
  return feedAccessibleLabel(
    feed.saved,
    feed.savedTarget,
    (theme) => feed.themes?.label(theme) ?? theme
  );
}

/**
 * The one way to the puzzle settings: a row naming them, with what the
 * feed serves now as its value line. The whole feed is also said in words
 * for someone listening, first, so the row's name says everything it shows
 * (WCAG 2.5.3). A row of a `MenuSection`.
 */
export function PuzzleSettingsRow(props: PuzzleSettingsRowProps): JSX.Element {
  const spoken = (): string =>
    [savedFeedSpoken(props.feed), props.allowanceLabel]
      .filter((part) => part.length > 0)
      .join(' ');
  return (
    <MenuRow
      dataSet={{ testid: 'chess-puzzle-feed-summary' }}
      onClick={() => props.onOpen()}
      leading={<SlidersHorizontalIcon size={20} color="textSecondary" />}
      title={
        <>
          <VisuallyHidden testId="chess-puzzle-feed-description">
            {spoken()}
          </VisuallyHidden>
          <Text variant="inherit" testId="chess-puzzle-feed-settings-label">
            <Trans>Puzzle settings</Trans>
          </Text>
        </>
      }
      caption={<ServedLine {...props} />}
    />
  );
}
