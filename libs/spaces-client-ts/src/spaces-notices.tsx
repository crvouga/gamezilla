import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';

/** "Spaces need a connection" — said plainly, never a silent failure. */
export function SpacesNeedConnectionNotice(): JSX.Element {
  return (
    <Notice
      tone="error"
      icon={WifiOffIcon}
      dataSet={{ testid: Handles.spacesNeedConnection }}
    >
      <Trans>
        Joining someone else's space needs a connection. Your own spaces work
        offline.
      </Trans>
    </Notice>
  );
}
