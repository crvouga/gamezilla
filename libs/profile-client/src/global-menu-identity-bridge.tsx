/** @jsxImportSource solid-js */
/**
 * Publishes the signed-in person's name and face into the shell's global
 * menu. Mounts inside the sync tree, because it reads profile rows; the shell
 * chrome that renders the menu sits above the local-database gate and only
 * ever sees the published values.
 *
 * The shell is told how to draw the face, not what it is made of — profile
 * owns avatar configs, and a shell composed without profile simply shows the
 * default glyph.
 */

import {
  BOOT_GLOBAL_MENU_IDENTITY,
  useGlobalMenuIdentityPublisher,
} from '@libs/app-root-client/global-menu-identity-context';
import { useSessionAccountEmail } from '@libs/auth-client/use-current-user';
import { usernameLabel } from '@libs/moderation-shared/display';
import { parseAvatarConfig } from '@libs/profile-shared/avatar-config';
import {
  type Accessor,
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { DeviceAvatar } from './device-avatar';
import { useMyProfileId } from './public-use-my-profile-id';
import { useProfileColumn } from './use-profile-column';

function PublishIdentity(props: {
  readonly profileId: string | null;
  readonly username: Accessor<string | null>;
  readonly avatarConfigRaw: Accessor<string | null>;
}): JSX.Element {
  const publish = useGlobalMenuIdentityPublisher();
  const email = useSessionAccountEmail();
  const avatarConfig = createMemo(() =>
    parseAvatarConfig(props.avatarConfigRaw())
  );
  // The face is a render thunk, and it reads the config where it renders —
  // inside the menu — rather than closing over the value at publish time. The
  // avatar then follows an edit without this effect having to republish.
  createEffect(() => {
    const profileId = props.profileId;
    const username = props.username();
    publish({
      usernameLabel:
        profileId === null ? null : usernameLabel(username, profileId),
      email: email(),
      avatar: (size) => (
        <DeviceAvatar
          avatarConfig={avatarConfig()}
          seedFallback={props.profileId ?? 'guest'}
          size={size}
        />
      ),
    });
  });
  onCleanup(() => publish(BOOT_GLOBAL_MENU_IDENTITY));
  return null;
}

function PublishFromProfile(props: {
  readonly profileId: string;
}): JSX.Element {
  const username = useProfileColumn(() => props.profileId, 'username');
  const avatarConfigRaw = useProfileColumn(
    () => props.profileId,
    'avatarConfig'
  );
  return (
    <PublishIdentity
      profileId={props.profileId}
      username={username}
      avatarConfigRaw={avatarConfigRaw}
    />
  );
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
        fallback={
          <PublishIdentity
            profileId={null}
            username={() => null}
            avatarConfigRaw={() => null}
          />
        }
      >
        {(id) => <PublishFromProfile profileId={id} />}
      </Show>
      {props.children}
    </>
  );
}
