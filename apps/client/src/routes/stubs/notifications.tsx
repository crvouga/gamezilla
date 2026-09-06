/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function NotificationsStub(): JSX.Element {
  return (
    <RouteStub screenId="notifications" title={<Trans>Notifications</Trans>} />
  );
}
