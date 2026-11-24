import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from '@solidjs/web';

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
