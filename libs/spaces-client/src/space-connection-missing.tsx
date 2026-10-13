import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { JSX } from 'solid-js';

/** This device has lost its connection. That is not the same as being idle. */
export function SpaceConnectionMissingNotice(): JSX.Element {
  return (
    <Notice
      tone="error"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.notificationsConnectionMissing }}
    >
      <Trans>The connection is missing.</Trans>
    </Notice>
  );
}
