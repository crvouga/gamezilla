/** @jsxImportSource solid-js */
/**
 * What profile contributes to a client app: the profile tab and the screens
 * that edit a person's name and face, the profile row provider, and the
 * bridge that publishes the account face into the shell's global menu.
 */

import { defineFeatureClient } from '@libs/feature-client/client';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { UserIcon } from '@pkgs/ui-root-client/icons';

/** Read inside the tab memo, so the label follows the active locale. */
function profileTabLabel(): string {
  const { t } = useLingui();
  return t`Profile`;
}

export const PROFILE_CLIENT = defineFeatureClient({
  name: 'profile',
  routes: [
    { path: '/profile', tab: true, load: () => import('./profile') },
    { path: '/profile/edit', load: () => import('./profile-edit') },
    { path: '/profile/handle', load: () => import('./profile-handle') },
    { path: '/profile/avatar', load: () => import('./profile-avatar') },
  ],
  tabs: [
    {
      name: 'ProfileTab',
      href: '/profile',
      order: 3,
      label: profileTabLabel,
      Icon: UserIcon,
      testID: Handles.tabProfile,
    },
  ],
  session: () => import('./session-provider'),
});
