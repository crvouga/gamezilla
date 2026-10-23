/** @jsxImportSource solid-js */
/**
 * Profile's session tree: the profile row provider, and the bridge that
 * publishes the account name and face into the shell's global menu.
 *
 * Loaded with the sync engine — both read synced rows.
 */

import type { JSX } from 'solid-js';

import { GlobalMenuIdentityLiveBridge } from './global-menu-identity-bridge';
import { ProfileProvider } from './profile-provider';

export default function ProfileSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <ProfileProvider>
      <GlobalMenuIdentityLiveBridge>
        {props.children}
      </GlobalMenuIdentityLiveBridge>
    </ProfileProvider>
  );
}
