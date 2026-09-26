/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function MoreServerStatusStub(): JSX.Element {
  return (
    <RouteStub
      screenId="more-server-status"
      title={<Trans>Server status</Trans>}
      parent={{ name: <Trans>Settings</Trans>, href: '/more' }}
    />
  );
}
