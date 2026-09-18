import { Trans } from '@lingui/solid/macro';
import { Button, EmptyState, SearchIcon, WifiOffIcon } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import type { PuzzlePickState } from '../../shared/puzzle-session/pick-state';
import {
  type ChessPuzzleFeedConfig,
  puzzleFeedHasNarrowingFilters,
} from '../chess-puzzle-feed-config';

export type ChessPuzzleEmptyPoolStateProps = {
  /** `'empty'`, `'offline'` or `'limited'`; other states never render this block. */
  kind: Exclude<PuzzlePickState, 'ready' | 'loading'>;
  size: number;
  config: ChessPuzzleFeedConfig;
  /** Drop history / theme filters so every synced puzzle is eligible. */
  onIncludeAllPuzzles: () => void;
  onOpenFeedSettings: () => void;
  /** Open the billing screen — the upgrade invitation a limit shows. */
  onUpgrade: () => void;
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
      dataSet={{ testid: 'chess-puzzle-empty-pool' }}
    />
  );
}

function LimitBlock(props: { onUpgrade: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={SearchIcon}
      title={<Trans>You've hit today's puzzle limit</Trans>}
      body={
        <Trans>Upgrade for unlimited puzzles, or come back tomorrow.</Trans>
      }
      action={{ label: <Trans>See plans</Trans>, onClick: props.onUpgrade }}
      dataSet={{ testid: 'chess-puzzle-limit' }}
    />
  );
}

function ExhaustedBlock(props: {
  config: ChessPuzzleFeedConfig;
  onIncludeAllPuzzles: () => void;
  onOpenFeedSettings: () => void;
}): JSX.Element {
  const canWiden = () => puzzleFeedHasNarrowingFilters(props.config);
  return (
    <div class="box items-center gap-3">
      <EmptyState
        icon={SearchIcon}
        title={<Trans>No puzzles match your feed</Trans>}
        body={
          <Show
            when={canWiden()}
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
        }
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
    </div>
  );
}

/** Fills the board well when the feed cannot place a puzzle. */
export function ChessPuzzleEmptyPoolState(
  props: ChessPuzzleEmptyPoolStateProps
): JSX.Element {
  return (
    <div
      class="box self-center bg-surface items-center justify-center overflow-hidden"
      style={{ width: `${props.size}px`, height: `${props.size}px` }}
    >
      <Show
        when={props.kind === 'empty'}
        fallback={
          <Show when={props.kind === 'limited'} fallback={<OfflineBlock />}>
            <LimitBlock onUpgrade={props.onUpgrade} />
          </Show>
        }
      >
        <ExhaustedBlock
          config={props.config}
          onIncludeAllPuzzles={props.onIncludeAllPuzzles}
          onOpenFeedSettings={props.onOpenFeedSettings}
        />
      </Show>
    </div>
  );
}
