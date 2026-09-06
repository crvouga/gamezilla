/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function AccountDevicesStub(): JSX.Element {
  return (
    <RouteStub
      screenId="account-devices"
      title={<Trans>Devices</Trans>}
      parent={{ name: <Trans>Account</Trans>, href: '/more/account' }}
    />
  );
}
