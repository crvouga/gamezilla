/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function ProfileHandleStub(): JSX.Element {
  return (
    <RouteStub
      screenId="profile-handle"
      title={<Trans>Username</Trans>}
      parent={{ name: <Trans>Profile</Trans>, href: '/profile' }}
    />
  );
}
