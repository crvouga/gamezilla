import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { CircleAlertIcon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/**
 * Above the game: a command the person may not give (finishing the current
 * game first, signing in), a refused command, and being offline.
 */
export function MultiplayerNotices(props: {
  readonly denial: DenialView | undefined;
  readonly error: string | null;
  readonly online: boolean;
  /** A search is under way: a refused command leaves it running. */
  readonly searching?: boolean | undefined;
}): JSX.Element {
  return (
    <>
      <Show when={props.denial}>
        {(denied) => <DenialSurfaceView variant="compact" denial={denied()} />}
      </Show>
      <Show when={props.error}>
        {(error) => (
          <Show
            when={props.searching === true}
            fallback={
              <ErrorState
                variant="compact"
                title={<Trans>That didn't go through</Trans>}
                body={
                  <>
                    {error()} <Trans>Nothing changed. Try again.</Trans>
                  </>
                }
                dataSet={{ testid: 'multiplayer-error' }}
              />
            }
          >
            <Notice
              icon={CircleAlertIcon}
              dataSet={{ testid: 'multiplayer-error' }}
            >
              <Text variant="inherit" role="status">
                <Trans>
                  Still searching. Stopping didn't go through, so your search is
                  still on. Press Stop searching to try again.
                </Trans>
              </Text>
            </Notice>
          </Show>
        )}
      </Show>
      <Show when={!props.online}>
        <Notice icon={WifiOffIcon} dataSet={{ testid: 'multiplayer-offline' }}>
          <Text variant="inherit" role="status">
            <Trans>
              You're offline. Searching and playing need a connection; your game
              stays here.
            </Trans>
          </Text>
        </Notice>
      </Show>
    </>
  );
}
