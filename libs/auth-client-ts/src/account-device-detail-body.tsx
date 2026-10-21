import { Trans } from '@lingui/solid/macro';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import { AccountDeviceActiveSessionLine } from './account-device-active-session-line';
import { AccountDeviceIdField } from './account-device-id-field';
import { AccountDeviceMetaGrid } from './account-device-meta-grid';
import { AccountDeviceUserAgentBlock } from './account-device-user-agent-block';

export type AccountDeviceDetailBodyProps = {
  deviceId: string;
};

/** Pure layout for a device detail body — meta rows, sessions, id, UA. */
export function AccountDeviceDetailBody(
  props: AccountDeviceDetailBodyProps
): JSX.Element {
  return (
    <>
      <AccountDeviceMetaGrid deviceId={props.deviceId} />
      <MenuSection
        title={<Trans>Sessions</Trans>}
        footer={<AccountDeviceUserAgentBlock deviceId={props.deviceId} />}
      >
        <AccountDeviceActiveSessionLine deviceId={props.deviceId} />
      </MenuSection>
      <AccountDeviceIdField deviceId={props.deviceId} />
    </>
  );
}
