/** @jsxImportSource solid-js */
/**
 * Live publisher for {@link GlobalMenuIdentityRoot}. Loaded only with the
 * sync-engine ready tree so profile / auth queries stay off the entry chunk.
 */

import { useSessionAccountEmail } from '@libs/auth/public/use-current-user';
import { useMyProfileId } from '@libs/profile/public/use-my-profile-id';
import { useProfileColumn } from '@libs/profile/public/use-profile-column';
import {
  type Accessor,
  createEffect,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

import {
  BOOT_GLOBAL_MENU_IDENTITY,
  useGlobalMenuIdentityPublisher,
} from './global-menu-identity-context';

function PublishIdentity(props: {
  readonly username: Accessor<string | null>;
}): JSX.Element {
  const publish = useGlobalMenuIdentityPublisher();
  const email = useSessionAccountEmail();
  createEffect(() => {
    publish({ username: props.username(), email: email() });
  });
  onCleanup(() => publish(BOOT_GLOBAL_MENU_IDENTITY));
  return null;
}

function PublishFromProfile(props: {
  readonly profileId: string;
}): JSX.Element {
  const username = useProfileColumn(props.profileId, 'username');
  return <PublishIdentity username={username} />;
}

/** Mount under `SyncEngineProvider`. */
export function GlobalMenuIdentityLiveBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const profileId = useMyProfileId();
  return (
    <>
      <Show
        when={profileId()}
        keyed
        fallback={<PublishIdentity username={() => null} />}
      >
        {(id) => <PublishFromProfile profileId={id} />}
      </Show>
      {props.children}
    </>
  );
}
