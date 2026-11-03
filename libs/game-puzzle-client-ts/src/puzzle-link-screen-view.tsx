import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { SearchIcon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';

/**
 * `opening`: the puzzle is being placed in the person's space; `offline`:
 * puzzles need a connection; `unavailable`: the puzzle was taken out.
 * A `denial` (no space to open it in) replaces all three.
 */
export type PuzzleLinkStatus = 'opening' | 'offline' | 'unavailable';

export type PuzzleLinkScreenViewProps = {
  readonly status: PuzzleLinkStatus;
  /** Set when the person cannot open another space for the puzzle. */
  readonly denial?: DenialView | undefined;
};

/**
 * `/puzzle/[puzzleId]`, presentational: what a puzzle link opens to while
 * it opens, or why it cannot — offline, no longer available, or denied.
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
      <Show
        when={props.denial}
        fallback={
          <Switch fallback={<LoadingState />}>
            <Match when={props.status === 'offline'}>
              <EmptyState
                icon={WifiOffIcon}
                title={<Trans>You're offline</Trans>}
                body={
                  <Trans>
                    Puzzles need a connection. Reconnect and open the puzzle
                    link again.
                  </Trans>
                }
                dataSet={{ testid: Handles.chessPuzzleOffline }}
              />
            </Match>
            <Match when={props.status === 'unavailable'}>
              <EmptyState
                icon={SearchIcon}
                title={<Trans>This puzzle is no longer available</Trans>}
                body={
                  <Trans>
                    It was taken out of the puzzles, so its link no longer opens
                    it.
                  </Trans>
                }
                dataSet={{ testid: Handles.chessPuzzleLinkUnavailable }}
              />
            </Match>
          </Switch>
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Show>
    </ContentScreen>
  );
}
