/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function AccountStub(): JSX.Element {
  return (
    <RouteStub
      screenId="account"
      title={<Trans>Account</Trans>}
      parent={{ name: <Trans>Settings</Trans>, href: '/more' }}
    />
  );
}
