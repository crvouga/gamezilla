/** @jsxImportSource solid-js */
/**
 * Chrome mounts above the SQLite gate, so the global menu cannot call
 * `createQuery` directly. A boot stub publishes a guest identity outside the
 * gate; whichever feature owns identity display mounts a live bridge inside
 * the sync tree and publishes into the same signal.
 *
 * The face is a render thunk rather than an avatar config: the shell knows
 * there is a face, not what a face is made of. With no feature to fill it,
 * the menu falls back to a plain person glyph.
 */

import { defineContext } from '@pkgs/solid-context-client/define-context';
import { type Accessor, createSignal, type JSX } from 'solid-js';

export type GlobalMenuIdentity = {
  readonly username: string | null;
  readonly email: string | null;
  /** Renders the account face at `size` px, or `null` for the shell default. */
  readonly avatar: ((size: number) => JSX.Element) | null;
};

export const BOOT_GLOBAL_MENU_IDENTITY: GlobalMenuIdentity = {
  username: null,
  email: null,
  avatar: null,
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

/** Boot stub: holds the signal the live identity bridge publishes into. */
export function GlobalMenuIdentityRoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [identity, setIdentity] = createSignal<GlobalMenuIdentity>(
    BOOT_GLOBAL_MENU_IDENTITY
  );
  return (
    <GlobalMenuIdentityContext.Provider value={identity}>
      <GlobalMenuIdentityPublisherContext.Provider value={setIdentity}>
        {props.children}
      </GlobalMenuIdentityPublisherContext.Provider>
    </GlobalMenuIdentityContext.Provider>
  );
}
