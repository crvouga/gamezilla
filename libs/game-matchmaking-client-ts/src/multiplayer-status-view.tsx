import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Switch } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';

/**
 * Why there is nothing to do here, and what to do about it: the game and
 * the search are still being read, the person may not see them (with the
 * way forward the denial unlocks), or the space's host has no game to
 * watch (with the way back to the game's choices).
 */
export function MultiplayerStatusView(
  props: MultiplayerPlaceFrame & {
    readonly title: string;
    /** Set in the `denied` stage. */
    readonly denial: DenialView | undefined;
    /** Leaves finding an opponent for the game's choices. */
    readonly onLeave: () => void;
  }
): JSX.Element {
  return (
    <MultiplayerMenuPlace {...props} title={props.title}>
      <Switch>
        <Match when={props.stage === 'denied' ? props.denial : undefined}>
          {(denial) => <DenialSurfaceView denial={denial()} />}
        </Match>
        <Match when={props.stage === 'unavailable'}>
          <EmptyState
            variant="compact"
            role="status"
            title={<Trans>No game to watch here</Trans>}
            body={
              <Trans>
                No multiplayer game is available to you. The host of this space
                has not found an opponent.
              </Trans>
            }
            action={{
              label: <Trans>Back to {props.title}</Trans>,
              onClick: () => props.onLeave(),
            }}
            dataSet={{ testid: 'multiplayer-unavailable' }}
          />
        </Match>
        <Match when={props.stage === 'loading'}>
          <LoadingState
            variant="compact"
            caption={<Trans>Loading the game…</Trans>}
            dataSet={{ testid: 'multiplayer-loading' }}
          />
        </Match>
      </Switch>
    </MultiplayerMenuPlace>
  );
}
