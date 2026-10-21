import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared/feed-config';
import { puzzleFeedHasNarrowingFilters } from '@libs/game-puzzle-shared/feed-config';
import type { PuzzlePickState } from '@libs/game-puzzle-shared/pick-state';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans } from '@lingui/solid/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ClockIcon, SearchIcon, WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { Text } from '@pkgs/ui-root-client/text';
import { type JSX, Show } from 'solid-js';

export type PuzzleEmptyPoolStateProps = {
  /** `'empty'`, `'offline'`, `'limited'` or `'waiting'`; `loading` never renders. */
  kind: Exclude<PuzzlePickState, 'ready' | 'loading'>;
  config: PuzzleFeedConfig;
  /** Drop history / theme filters so every synced puzzle is eligible. */
  onIncludeAllPuzzles: () => void;
  onOpenFeedSettings: () => void;
  /** The permission decision behind `'limited'` (null otherwise). */
  denial: Decision | null;
};

function OfflineBlock(): JSX.Element {
  return (
    <EmptyState
      icon={WifiOffIcon}
      title={<Trans>You're offline</Trans>}
      body={
        <Trans>
          Puzzles download the first time you open the feed. Reconnect and they
          will appear here.
        </Trans>
      }
      dataSet={{ testid: 'chess-puzzle-offline' }}
    />
  );
}

function WaitingBlock(): JSX.Element {
  return (
    <EmptyState
      icon={ClockIcon}
      title={<Trans>Waiting for the host</Trans>}
      body={<Trans>The host hasn't started a puzzle yet.</Trans>}
      dataSet={{ testid: 'chess-puzzle-waiting-for-host' }}
    />
  );
}

/**
 * "Failed" with no theme: the window falls back to every synced puzzle, so
 * an empty feed means no puzzle was ever failed.
 */
function isEmptyForNoFailedAttempts(config: PuzzleFeedConfig): boolean {
  return config.historyFilter === 'failed' && config.themes.length === 0;
}

function ExhaustedBody(props: { config: PuzzleFeedConfig }): JSX.Element {
  return (
    <Show
      when={!isEmptyForNoFailedAttempts(props.config)}
      fallback={
        <Text variant="inherit" testId="chess-puzzle-empty-pool-no-failed">
          <Trans>
            You have no failed puzzles yet. Puzzles you fail show here to try
            again.
          </Trans>
        </Text>
      }
    >
      <Show
        when={puzzleFeedHasNarrowingFilters(props.config)}
        fallback={
          <Trans>
            Nothing synced near this rating yet. Change the target rating to
            keep playing.
          </Trans>
        }
      >
        <Trans>
          You have played every puzzle that matches your history and theme
          filters. Include played puzzles or adjust the feed.
        </Trans>
      </Show>
    </Show>
  );
}

function ExhaustedBlock(props: {
  config: PuzzleFeedConfig;
  onIncludeAllPuzzles: () => void;
  onOpenFeedSettings: () => void;
}): JSX.Element {
  const canWiden = () => puzzleFeedHasNarrowingFilters(props.config);
  return (
    <StackVertical align="center" gap="md">
      <EmptyState
        icon={SearchIcon}
        title={<Trans>No puzzles match your feed</Trans>}
        body={<ExhaustedBody config={props.config} />}
        action={
          canWiden()
            ? {
                label: <Trans>Include played puzzles</Trans>,
                onClick: props.onIncludeAllPuzzles,
              }
            : {
                label: <Trans>Adjust feed</Trans>,
                onClick: props.onOpenFeedSettings,
              }
        }
        dataSet={{ testid: 'chess-puzzle-empty-pool' }}
      />
      <Show when={canWiden()}>
        <Button
          title={<Trans>Adjust feed</Trans>}
          intent="neutral"
          variant="ghost"
          onClick={props.onOpenFeedSettings}
          dataSet={{ testid: 'chess-puzzle-empty-pool-adjust' }}
        />
      </Show>
    </StackVertical>
  );
}

/** Fills the board well when the feed cannot place a puzzle. */
export function PuzzleEmptyPoolState(
  props: PuzzleEmptyPoolStateProps
): JSX.Element {
  return (
    <Surface
      tone="surface"
      width="full"
      height="full"
      align="center"
      justify="center"
      overflow="hidden"
    >
      <Show
        when={props.kind === 'empty'}
        fallback={
          <Show
            when={props.kind === 'limited'}
            fallback={
              <Show when={props.kind === 'waiting'} fallback={<OfflineBlock />}>
                <WaitingBlock />
              </Show>
            }
          >
            <Show when={props.denial} keyed>
              {(decision) => (
                <DenialSurface
                  decision={decision}
                  testId="chess-puzzle-limit"
                />
              )}
            </Show>
          </Show>
        }
      >
        <ExhaustedBlock
          config={props.config}
          onIncludeAllPuzzles={props.onIncludeAllPuzzles}
          onOpenFeedSettings={props.onOpenFeedSettings}
        />
      </Show>
    </Surface>
  );
}
