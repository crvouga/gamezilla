import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { JSX } from 'solid-js';

export function SpaceHostOfflineNotice(): JSX.Element {
  return (
    <Notice
      tone="info"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.spaceHostOffline }}
    >
      <Trans>
        The host is offline. This space will reconnect when they return.
      </Trans>
    </Notice>
  );
}
