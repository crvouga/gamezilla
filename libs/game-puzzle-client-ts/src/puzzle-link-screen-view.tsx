import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SearchIcon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Switch } from 'solid-js';

/**
 * `opening`: the puzzle is being placed in the person's space; `offline`:
 * puzzles need a connection; `unavailable`: the puzzle was taken out;
 * `denied`: the person cannot open another space for it (`denial` says
 * why, and what unlocks it).
 */
export type PuzzleLinkStatus = 'opening' | 'offline' | 'unavailable' | 'denied';

export type PuzzleLinkScreenViewProps = {
  readonly status: PuzzleLinkStatus;
  /** Why no space can be opened for the puzzle, for `denied`. */
  readonly denial?: DenialView | undefined;
  /** Open the link again, once back online. */
  readonly onRetry: () => void;
  /** Leave for the app's home: the link itself leads nowhere. */
  readonly onGoHome: () => void;
};

/**
 * `/puzzle/[puzzleId]`, presentational: what a puzzle link opens to while
 * it opens, or why it cannot, each with the one thing to do: offline (try
 * again), no longer available (go home), or denied (what unlocks it).
 * `PuzzleLinkScreen` wires it to the route and the person's space.
 */
export function PuzzleLinkScreenView(
  props: PuzzleLinkScreenViewProps
): JSX.Element {
  return (
    <ContentScreen
      screenId="chess-puzzle-link"
      breadcrumbs={[{ name: <Trans>Puzzle</Trans> }]}
      dataSet={{ testid: Handles.chessPuzzleLinkScreen }}
    >
      <Switch fallback={<LoadingState caption={<Trans>Opening puzzle…</Trans>} />}>
        <Match when={props.status === 'denied' && props.denial} keyed>
          {(denial) => <DenialSurfaceView denial={denial} />}
        </Match>
        <Match when={props.status === 'offline'}>
          <EmptyState
            icon={WifiOffIcon}
            title={<Trans>You're offline</Trans>}
            body={<Trans>Puzzles need a connection. Reconnect and try again.</Trans>}
            action={{
              label: <Trans>Try again</Trans>,
              onClick: props.onRetry,
            }}
            dataSet={{ testid: Handles.chessPuzzleOffline }}
          />
        </Match>
        <Match when={props.status === 'unavailable'}>
          <EmptyState
            icon={SearchIcon}
            title={<Trans>This puzzle is no longer available</Trans>}
            body={
              <Trans>
                It was taken out of the puzzles, so its link no longer opens it.
              </Trans>
            }
            action={{
              label: <Trans>Go to home</Trans>,
              onClick: props.onGoHome,
            }}
            dataSet={{ testid: Handles.chessPuzzleLinkUnavailable }}
          />
        </Match>
      </Switch>
    </ContentScreen>
  );
}
