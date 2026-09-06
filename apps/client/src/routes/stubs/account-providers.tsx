/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function AccountProvidersStub(): JSX.Element {
  return (
    <RouteStub
      screenId="account-providers"
      title={<Trans>Sign-in providers</Trans>}
      parent={{ name: <Trans>Account</Trans>, href: '/more/account' }}
    />
  );
}
