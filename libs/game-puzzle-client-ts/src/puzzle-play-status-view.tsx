import { puzzleFeedHasNarrowingFilters } from '@libs/game-puzzle-shared-ts/feed-config';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import {
  ClockIcon,
  SearchIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSettingsRow } from './puzzle-settings-row';

/**
 * "Failed" with no theme: the window falls back to every synced puzzle, so
 * an empty feed means no puzzle was ever failed.
 */
function isEmptyForNoFailedAttempts(config: PuzzleFeedConfig): boolean {
  return config.historyFilter === 'failed' && config.themes.length === 0;
}

/** Why the saved feed fits no puzzle. */
function ExhaustedBody(props: { config: PuzzleFeedConfig }): JSX.Element {
  return (
    <Switch
      fallback={
        <Trans>
          Nothing synced near this rating yet. Change the target rating to keep
          playing.
        </Trans>
      }
    >
      <Match when={isEmptyForNoFailedAttempts(props.config)}>
        <Text variant="inherit" testId="chess-puzzle-empty-pool-no-failed">
          <Trans>
            You have no failed puzzles yet. Puzzles you fail show here to try
            again.
          </Trans>
        </Text>
      </Match>
      <Match when={puzzleFeedHasNarrowingFilters(props.config)}>
        <Trans>
          You have played every puzzle that matches your history and theme
          filters. Include played puzzles or change the puzzle settings.
        </Trans>
      </Match>
    </Switch>
  );
}

/**
 * The feed is exhausted. The one thing to do is to widen it when filters
 * narrow it, and to change its settings otherwise.
 */
function ExhaustedState(props: PuzzlePlayScreenViewProps): JSX.Element {
  const canWiden = (): boolean =>
    puzzleFeedHasNarrowingFilters(props.feed.saved);
  return (
    <EmptyState
      icon={SearchIcon}
      title={<Trans>No puzzles match your feed</Trans>}
      body={<ExhaustedBody config={props.feed.saved} />}
      action={
        canWiden()
          ? {
              label: <Trans>Include played puzzles</Trans>,
              onClick: props.onIncludeAllPuzzles,
            }
          : {
              label: <Trans>Change puzzle settings</Trans>,
              onClick: () => props.onOpen({ screen: 'feed' }),
            }
      }
      dataSet={{ testid: 'chess-puzzle-empty-pool' }}
    />
  );
}

/** Why no puzzle is on the board, each state on its own. */
function StatusState(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.stage === 'loading'}>
        <LoadingState caption={<Trans>Finding your next puzzle…</Trans>} />
      </Match>
      <Match when={props.stage === 'offline'}>
        <EmptyState
          icon={WifiOffIcon}
          title={<Trans>You're offline</Trans>}
          body={
            <Trans>
              Puzzles download the first time you open the feed. Reconnect and
              they will appear here.
            </Trans>
          }
          dataSet={{ testid: 'chess-puzzle-offline' }}
        />
      </Match>
      <Match when={props.stage === 'limited' && props.denial} keyed>
        {(denial) => <DenialSurfaceView denial={denial} />}
      </Match>
      <Match when={props.stage === 'empty'}>
        <ExhaustedState {...props} />
      </Match>
      <Match when={props.stage === 'waiting'}>
        <EmptyState
          icon={ClockIcon}
          title={<Trans>Waiting for the host</Trans>}
          body={<Trans>The host hasn't started a puzzle yet.</Trans>}
          dataSet={{ testid: 'chess-puzzle-waiting-for-host' }}
        />
      </Match>
    </Switch>
  );
}

/**
 * The `status` place: why there is no puzzle on the board (a pick is
 * pending, the device is offline, the rated limit, an exhausted feed, a
 * host who has started none) and the one thing to do about it. A solver
 * also gets the row to the puzzle settings; a watcher has none to set.
 */
export function PuzzlePlayStatusView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="chess-puzzle-status"
      title={<Trans>Puzzles</Trans>}
    >
      <StackVertical gap="xl">
        <StatusState {...props} />
        <Show when={props.stage !== 'waiting'}>
          <MenuSection>
            <PuzzleSettingsRow
              feed={props.feed}
              allowanceLabel={props.allowanceLabel}
              onOpen={() => props.onOpen({ screen: 'feed' })}
            />
          </MenuSection>
        </Show>
      </StackVertical>
    </EmbeddedScreen>
  );
}
