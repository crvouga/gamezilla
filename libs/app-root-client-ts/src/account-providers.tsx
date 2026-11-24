/** @jsxImportSource @solidjs/web */
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';

import { RouteStub } from './route-stub';

export default function AccountProvidersStub(): JSX.Element {
  return (
    <RouteStub
      screenId="account-providers"
      title={<Trans>Sign-in providers</Trans>}
      parent={{ name: <Trans>Account</Trans>, href: '/more/account' }}
    />
  );
}
