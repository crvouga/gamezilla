import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { AvatarRefusedChangeNotice } from './avatar-refused-change-notice';
import { useProfileRow } from './claim-username-use-profile-row';
import {
  type ProfileIdentity,
  type ProfileScreenStatus,
  ProfileScreenView,
} from './profile-screen-view';
import { useMyProfileId } from './public-use-my-profile-id';
import { useFirstSyncError } from './use-first-sync-error';
import { useStandInName } from './use-stand-in-name';
import { useUsernameChange } from './use-username-change';

export type ProfileScreenProps = {
  /** Centered friends stats row (signed-in counts; guests open sign-in on tap). */
  readonly friendsStats?: JSX.Element | undefined;
  /** Second action pill beside Edit profile (e.g. Find friends). */
  readonly friendsActions?: JSX.Element | undefined;
};

/**
 * `/profile`: wires `ProfileScreenView` to the person's own profile row.
 * While the sync engine's paint gate is closed (sticky on a prior identity)
 * nothing is read, so the wrong person's name and face never flash.
 */
export function ProfileScreen(props: ProfileScreenProps): JSX.Element {
  const router = useRouter();
  const engine = useSyncEngine();
  const profileId = useMyProfileId();
  const { row, isLoading } = useProfileRow(profileId);
  const firstSyncError = useFirstSyncError();
  const standInName = useStandInName(row);
  const usernameChange = useUsernameChange();
  const status = createMemo((): ProfileScreenStatus => {
    if (!engine.paintReady() || (isLoading() && row() === null))
      return 'loading';
    return row() === null && firstSyncError() ? 'failed' : 'ready';
  });
  const identity = createMemo((): ProfileIdentity | null => {
    const id = profileId();
    if (!engine.paintReady() || id === null) return null;
    const current = row();
    return {
      profileId: id,
      username: current?.username ?? null,
      avatarConfig: parseAvatarConfig(current?.avatar_config ?? null),
      isBot: current?.account_kind === 'synthetic',
    };
  });
  return (
    <ProfileScreenView
      status={status()}
      identity={identity()}
      standInName={standInName()}
      usernameChange={usernameChange()}
      notice={<AvatarRefusedChangeNotice />}
      friendsStats={props.friendsStats}
      friendsActions={props.friendsActions}
      onEditProfile={() => router.push('/profile/edit')}
      onChooseUsername={() => router.push('/profile/handle')}
      onRetry={() => void engine.refreshQueries()}
    />
  );
}
