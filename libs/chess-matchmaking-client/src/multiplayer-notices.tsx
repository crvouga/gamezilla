import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

export function MultiplayerNotices(props: {
  controls: MultiplayerControlsModel;
  online: boolean;
}): JSX.Element {
  return (
    <>
      <Show when={props.controls.denial()}>
        {(denied) => (
          <DenialSurface
            decision={denied()}
            testId="multiplayer-command-denial"
          />
        )}
      </Show>
      <Show when={props.controls.error()}>
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
        <p
          role="status"
          data-testid="multiplayer-offline"
          class="rounded-xl bg-warning-surface p-4 text-sm"
        >
          <Trans>
            Multiplayer commands need a connection. Your accepted game stays
            here.
          </Trans>
        </p>
      </Show>
    </>
  );
}
