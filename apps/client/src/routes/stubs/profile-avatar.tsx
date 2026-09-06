/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function ProfileAvatarStub(): JSX.Element {
  return (
    <RouteStub
      screenId="profile-avatar"
      title={<Trans>Avatar</Trans>}
      parent={{ name: <Trans>Profile</Trans>, href: '/profile' }}
    />
  );
}
