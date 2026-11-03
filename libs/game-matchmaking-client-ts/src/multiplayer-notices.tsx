import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
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
}): JSX.Element {
  return (
    <>
      <Show when={props.denial}>
        {(denied) => <DenialSurfaceView denial={denied()} />}
      </Show>
      <Show when={props.error}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={<Trans>Multiplayer command refused</Trans>}
            body={error()}
            dataSet={{ testid: 'multiplayer-error' }}
          />
        )}
      </Show>
      <Show when={!props.online}>
        <Notice icon={WifiOffIcon} dataSet={{ testid: 'multiplayer-offline' }}>
          <Text variant="inherit" role="status">
            <Trans>
              Multiplayer commands need a connection. Your accepted game stays
              here.
            </Trans>
          </Text>
        </Notice>
      </Show>
    </>
  );
}
