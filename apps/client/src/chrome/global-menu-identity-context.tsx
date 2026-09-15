/** @jsxImportSource solid-js */
/**
 * Chrome mounts above the SQLite gate, so the global menu cannot call
 * `createQuery` directly. Mirror {@link SyncStatusRoot}: a boot stub outside;
 * {@link GlobalMenuIdentityLiveBridge} (loaded with the sync tree) publishes
 * username, email, and avatar into the same signal.
 */

import type { AvatarConfig } from '@libs/profile/public/avatar-config';
import { defineContext } from '@pkgs/solid-context/define-context';
import { type Accessor, createSignal, type JSX } from 'solid-js';

export type GlobalMenuIdentity = {
  readonly username: string | null;
  readonly email: string | null;
  readonly profileId: string | null;
  readonly avatarConfig: AvatarConfig | null;
};

export const BOOT_GLOBAL_MENU_IDENTITY: GlobalMenuIdentity = {
  username: null,
  email: null,
  profileId: null,
  avatarConfig: null,
};

const GlobalMenuIdentityContext =
  defineContext<Accessor<GlobalMenuIdentity>>('GlobalMenuIdentity');

type GlobalMenuIdentityPublisher = (identity: GlobalMenuIdentity) => void;

const GlobalMenuIdentityPublisherContext =
  defineContext<GlobalMenuIdentityPublisher>('GlobalMenuIdentityPublisher');

export const useGlobalMenuIdentity = GlobalMenuIdentityContext.use;

export function useGlobalMenuIdentityPublisher(): GlobalMenuIdentityPublisher {
  return GlobalMenuIdentityPublisherContext.use();
}

export function GlobalMenuIdentityRoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [identity, setIdentity] = createSignal(BOOT_GLOBAL_MENU_IDENTITY);
  return (
    <GlobalMenuIdentityPublisherContext.Provider value={setIdentity}>
      <GlobalMenuIdentityContext.Provider value={identity}>
        {props.children}
      </GlobalMenuIdentityContext.Provider>
    </GlobalMenuIdentityPublisherContext.Provider>
  );
}
