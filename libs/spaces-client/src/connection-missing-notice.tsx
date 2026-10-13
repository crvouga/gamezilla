import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { JSX } from 'solid-js';

/** Someone already in a space has lost the connection. */
export function ConnectionMissingNotice(): JSX.Element {
  return (
    <Notice
      tone="error"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.connectionMissing }}
    >
      <Trans>The connection is missing.</Trans>
    </Notice>
  );
}
