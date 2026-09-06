/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function FriendUserStub(): JSX.Element {
  return (
    <RouteStub
      screenId="friend-user"
      title={<Trans>User</Trans>}
      parent={{ name: <Trans>Friends</Trans>, href: '/profile/friends' }}
    />
  );
}
