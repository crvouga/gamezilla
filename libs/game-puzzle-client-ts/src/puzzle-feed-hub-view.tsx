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
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import {
  autoAdvanceLabel,
  historyFilterLabel,
  targetLabel,
  themesSummary,
} from './puzzle-feed-words';
import type { PuzzleFeedSettingScreen } from './puzzle-play-places';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { savedFeedSpoken } from './puzzle-settings-row';
import { PuzzleShareLabel } from './puzzle-share-label';

/** A setting's row: its name, its unsaved value, and the way to its screen. */
function SettingRow(props: {
  readonly view: PuzzlePlayScreenViewProps;
  readonly screen: PuzzleFeedSettingScreen;
  readonly title: JSX.Element;
  readonly value: string;
  readonly testId: string;
}): JSX.Element {
  return (
    <MenuRow
      title={props.title}
      value={props.value}
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
            {props.feed.matched} matching · {props.feed.total} local puzzles
          </Trans>
        </Text>
      }
    >
      <SettingRow
        view={props}
        screen="feed-target"
        title={<Trans>Target rating</Trans>}
        value={targetLabel(props.feed.draft, props.feed.draftTarget)}
        testId="chess-puzzle-feed-row-target"
      />
      <SettingRow
        view={props}
        screen="feed-history"
        title={<Trans>Play history</Trans>}
        value={historyFilterLabel(props.feed.draft.historyFilter)}
        testId="chess-puzzle-feed-row-history"
      />
      <Show when={props.feed.themes !== null}>
        <SettingRow
          view={props}
          screen="feed-themes"
          title={<Trans>Themes</Trans>}
          value={themesSummary(props.feed.draft.themes, themeLabel)}
          testId={Handles.chessPuzzleFeedThemeTrigger}
        />
      </Show>
      <SettingRow
        view={props}
        screen="feed-advance"
        title={<Trans>After solving</Trans>}
        value={autoAdvanceLabel(props.feed.draft.autoAdvance)}
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
        // What is saved now, beside the draft the rows below hold.
        <Text variant="inherit" testId="chess-puzzle-feed-description">
          <Trans>Saved now: {savedFeedSpoken(props.feed)}</Trans>
        </Text>
      }
    >
      <StackVertical gap="xl">
        <FeedSettings {...props} />
        <Show when={props.feed.status === 'ready'}>
          <StackVertical gap="sm">
            <Button
              title={<Trans>Done</Trans>}
              fullWidth
              onClick={() => props.feed.onDone()}
              dataSet={{ testid: Handles.chessPuzzleFeedDone }}
            />
            <P variant="caption" tone="secondary" align="center">
              <Trans>
                Done saves these settings. Going back keeps the feed as it was.
              </Trans>
            </P>
          </StackVertical>
        </Show>
        <ThisPuzzle {...props} />
      </StackVertical>
    </EmbeddedScreen>
  );
}
