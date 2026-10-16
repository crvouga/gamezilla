import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { type JSX, Show } from 'solid-js';

/** Host participation affects shared features without moving local content. */
export function SpaceHostConnectionStatus(props: {
  readonly offline: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const label = () =>
    t`The host is offline. This space will reconnect when they return.`;
  return (
    <div
      class="box h-8 w-8 shrink-0 items-center justify-center"
      data-component="SpaceHostConnectionStatus"
    >
      <Show when={props.offline}>
        <span
          role="status"
          title={label()}
          data-testid={Handles.spaceHostOffline}
        >
          <WifiOffIcon size={20} color="icon" />
          <span class="sr-only">{label()}</span>
        </span>
      </Show>
    </div>
  );
}
