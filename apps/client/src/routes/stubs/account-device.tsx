/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function AccountDeviceStub(): JSX.Element {
  return (
    <RouteStub
      screenId="account-device"
      title={<Trans>Device</Trans>}
      parent={{ name: <Trans>Devices</Trans>, href: '/more/account/devices' }}
    />
  );
}
