import ProfileScreen from './profile';
import ProfileAvatarScreen from './profile-avatar';
import ProfileEditScreen from './profile-edit';
import ProfileHandleScreen from './profile-handle';
import SessionProvider from './session-provider';
/** @jsxImportSource solid-js */
/**
 * What profile contributes to a client app: the profile tab and the screens
 * that edit a person's name and face, the profile row provider, and the
 * bridge that publishes the account face into the shell's global menu.
 */

import { defineSubClient } from '@libs/sub-client/client';
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { UserIcon } from '@pkgs/ui-root-client/icons';

/** Read inside the tab memo, so the label follows the active locale. */
function profileTabLabel(): string {
  const { t } = useLingui();
  return t`Profile`;
}

export const PROFILE_CLIENT = defineSubClient({
  name: 'profile',
  routes: [
    { path: '/profile', tab: true, component: ProfileScreen },
    { path: '/profile/edit', component: ProfileEditScreen },
    { path: '/profile/handle', component: ProfileHandleScreen },
    { path: '/profile/avatar', component: ProfileAvatarScreen },
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
  session: SessionProvider,
});
