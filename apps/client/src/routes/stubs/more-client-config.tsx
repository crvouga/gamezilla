/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function MoreClientConfigStub(): JSX.Element {
  return (
    <RouteStub
      screenId="more-client-config"
      title={<Trans>Client config</Trans>}
      parent={{ name: <Trans>Settings</Trans>, href: '/more' }}
    />
  );
}
