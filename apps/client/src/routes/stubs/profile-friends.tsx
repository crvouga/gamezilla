/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function ProfileFriendsStub(): JSX.Element {
  return (
    <RouteStub
      screenId="profile-friends"
      title={<Trans>Friends</Trans>}
      parent={{ name: <Trans>Profile</Trans>, href: '/profile' }}
    />
  );
}
