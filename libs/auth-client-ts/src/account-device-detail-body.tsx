import { Trans } from '@lingui/solid/macro';
import type { ClipboardCopy } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import { AccountDeviceActiveSessionLine } from './account-device-active-session-line';
import { AccountDeviceIdField } from './account-device-id-field';
import { AccountDeviceMetaGrid } from './account-device-meta-grid';
import { AccountDeviceUserAgentBlock } from './account-device-user-agent-block';
import type { AccountDeviceView } from './account-device-view';

export type AccountDeviceDetailBodyProps = {
  readonly device: AccountDeviceView;
  /** Writes the device id to the clipboard. */
  readonly copy: ClipboardCopy;
};

/** Pure layout for a device detail body — meta rows, sessions, id, UA. */
export function AccountDeviceDetailBody(
  props: AccountDeviceDetailBodyProps
): JSX.Element {
  return (
    <>
      <AccountDeviceMetaGrid device={props.device} />
      <MenuSection
        title={<Trans>Sessions</Trans>}
        footer={
          <AccountDeviceUserAgentBlock userAgent={props.device.userAgent} />
        }
      >
        <AccountDeviceActiveSessionLine device={props.device} />
      </MenuSection>
      <AccountDeviceIdField deviceId={props.device.id} copy={props.copy} />
    </>
  );
}
