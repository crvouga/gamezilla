import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { StatusIconSlot } from '@pkgs/ui-root-client/status-icon-slot';
import type { JSX } from 'solid-js';

/** Host participation affects shared features without moving local content. */
export function SpaceHostConnectionStatus(props: {
  readonly offline: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StatusIconSlot
      shown={props.offline}
      icon={WifiOffIcon}
      label={t`The host is offline. This space will reconnect when they return.`}
      testId={Handles.spaceHostOffline}
    />
  );
}
