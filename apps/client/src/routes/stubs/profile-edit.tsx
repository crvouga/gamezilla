/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function ProfileEditStub(): JSX.Element {
  return (
    <RouteStub
      screenId="profile-edit"
      title={<Trans>Edit profile</Trans>}
      parent={{ name: <Trans>Profile</Trans>, href: '/profile' }}
    />
  );
}
