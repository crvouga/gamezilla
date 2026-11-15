import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ShareIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Match, Show, Switch } from 'solid-js';
import {
  autoAdvanceLabel,
  historyFilterLabel,
  targetValue,
  themesSummary,
} from './puzzle-feed-words';
import type { PuzzleFeedSettingScreen } from './puzzle-play-places';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { savedFeedSpoken } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';

/** Which settings the draft has changed from what is saved. */
function draftChanges(feed: PuzzlePlayScreenViewProps['feed']) {
  const saved = feed.saved;
  const draft = feed.draft;
  const target =
    saved.mode !== draft.mode ||
    (draft.mode === 'custom'
      ? saved.customRating !== draft.customRating
      : saved.autoOffset !== draft.autoOffset);
  const themes =
    [...saved.themes].sort().join(',') !== [...draft.themes].sort().join(',');
  return {
    target,
    history: saved.historyFilter !== draft.historyFilter,
    themes,
    advance: saved.autoAdvance !== draft.autoAdvance,
  };
}

function hasDraftChanges(feed: PuzzlePlayScreenViewProps['feed']): boolean {
  return Object.values(draftChanges(feed)).some(Boolean);
}

/**
 * A setting's row: its name, its value in the draft (marked when that is
 * not saved yet), and the way to its screen.
 */
function SettingRow(props: {
  readonly view: PuzzlePlayScreenViewProps;
  readonly screen: PuzzleFeedSettingScreen;
  readonly title: JSX.Element;
  readonly value: string;
  readonly changed: boolean;
  readonly testId: string;
}): JSX.Element {
  return (
    <MenuRow
      title={props.title}
      value={props.value}
      caption={
        props.changed ? (
          <Text variant="inherit" tone="tint">
            <Trans>Changed, not saved yet</Trans>
          </Text>
        ) : undefined
      }
      onClick={() => props.view.onOpen({ screen: props.screen })}
      dataSet={{ testid: props.testId }}
    />
  );
}

/** One row per setting, each showing what the draft holds. */
function FeedRows(props: PuzzlePlayScreenViewProps): JSX.Element {
  const themeLabel = (theme: string): string =>
    props.feed.themes?.label(theme) ?? theme;
  return (
    <MenuSection
      title={<Trans>The feed serves</Trans>}
      footer={
        <Text variant="inherit" testId={Handles.chessPuzzleFeedPool}>
          <Trans>
            {props.feed.matched} of {props.feed.total} puzzles on this device
            match
          </Trans>
        </Text>
      }
    >
      <SettingRow
        view={props}
        screen="feed-target"
        title={<Trans>Target rating</Trans>}
        value={targetValue(props.feed.draft, props.feed.draftTarget)}
        changed={draftChanges(props.feed).target}
        testId="chess-puzzle-feed-row-target"
      />
      <SettingRow
        view={props}
        screen="feed-history"
        title={<Trans>Play history</Trans>}
        value={historyFilterLabel(props.feed.draft.historyFilter)}
        changed={draftChanges(props.feed).history}
        testId="chess-puzzle-feed-row-history"
      />
      <Show when={props.feed.themes !== null}>
        <SettingRow
          view={props}
          screen="feed-themes"
          title={<Trans>Themes</Trans>}
          value={themesSummary(props.feed.draft.themes, themeLabel)}
          changed={draftChanges(props.feed).themes}
          testId={Handles.chessPuzzleFeedThemeTrigger}
        />
      </Show>
      <SettingRow
        view={props}
        screen="feed-advance"
        title={<Trans>After solving</Trans>}
        value={autoAdvanceLabel(props.feed.draft.autoAdvance)}
        changed={draftChanges(props.feed).advance}
        testId="chess-puzzle-feed-row-advance"
      />
    </MenuSection>
  );
}

/** The settings, or why they cannot be set, each state on its own. */
function FeedSettings(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.feed.status === 'locked' && props.feed.denial} keyed>
        {(denial) => <DenialSurfaceView denial={denial} variant="compact" />}
      </Match>
      <Match when={props.feed.status === 'loading'}>
        <LoadingState variant="compact" />
      </Match>
      <Match when={props.feed.status === 'ready'}>
        <FeedRows {...props} />
      </Match>
    </Switch>
  );
}

/** The puzzle on the board, by its link. */
function ThisPuzzle(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Show when={props.share} keyed>
      {(share) => (
        <MenuSection title={<Trans>This puzzle</Trans>}>
          <MenuRow
            leading={<ShareIcon size={20} color="textSecondary" />}
            title={<PuzzleShareLabel state={share.state} />}
            hideChevron
            onClick={() => share.onShare()}
            dataSet={{ testid: Handles.chessPuzzleShareLink }}
          />
        </MenuSection>
      )}
    </Show>
  );
}

/**
 * The `feed` place: what the feed serves next, one row per setting with
 * its current value, and how many puzzles fit. The rows edit a draft: Done
 * saves it, going back keeps the feed as it was. Customizing is for
 * accounts; a guest is told how to get one instead.
 */
export function PuzzleFeedHubView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-feed"
      title={<Trans>Puzzle settings</Trans>}
      subtitle={
        <>
          <Trans>Changes apply when you save.</Trans>
          {/* What is saved now, for someone listening, beside the draft
              the rows below hold. */}
          <VisuallyHidden testId="chess-puzzle-feed-description">
            <Trans>Saved now: {savedFeedSpoken(props.feed)}</Trans>
          </VisuallyHidden>
        </>
      }
    >
      <StackVertical gap="xl">
        <FeedSettings {...props} />
        <Show when={props.feed.status === 'ready'}>
          <StackVertical gap="sm">
            <Button
              title={<Trans>Save settings</Trans>}
              fullWidth
              onClick={() => props.feed.onDone()}
              dataSet={{ testid: Handles.chessPuzzleFeedDone }}
            />
            {/* Leaving drops the draft: the next visit starts from what is
                saved. Said as its own command once there is something to
                drop, so it is never a guess. */}
            <Show when={hasDraftChanges(props.feed)}>
              <Button
                title={<Trans>Discard changes</Trans>}
                intent="neutral"
                variant="outline"
                fullWidth
                onClick={() => props.onBack()}
                dataSet={{ testid: 'chess-puzzle-feed-discard' }}
              />
            </Show>
          </StackVertical>
        </Show>
        <ThisPuzzle {...props} />
      </StackVertical>
    </EmbeddedScreen>
  );
}
