import {
  useMyAccountId,
  useMyDeviceId,
  useMyId,
} from '@libs/auth/client/use-current-user';
import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { resolveCurrentDeviceLabel } from './resolve-device-label';
import { joinSpaceRemote } from '../spaces-actions';
import { useSpacesClientDeps } from '../use-spaces-client-deps';
import {
  endSpaceAction,
  leaveSpaceAction,
  renameSpaceAction,
  setVisibilityAction,
  writeCreateSpaceAction,
} from './space-lifecycle-writes';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

function useHostProfileSnapshot(profileId: string) {
  const hostUsername = useProfileColumn(profileId, ProfileField.username);
  const hostAvatar = useProfileColumn(profileId, ProfileField.avatarConfig);
  return {
    hostUsername:
      hostUsername !== null && hostUsername.length > 0 ? hostUsername : null,
    hostAvatarConfig:
      hostAvatar !== null && hostAvatar.length > 0 ? hostAvatar : null,
  };
}

function useSpaceLifecycleMutations(deviceId: string, accountId: string | null) {
  const engine = useSyncEngine();
  const leaveSpace = useCallback(
    (spaceId: string) => leaveSpaceAction(engine.db, deviceId, spaceId),
    [engine, deviceId]
  );
  const endSpace = useCallback(
    (spaceId: string) => endSpaceAction(engine.db, deviceId, spaceId),
    [engine, deviceId]
  );
  const renameSpace = useCallback(
    (spaceId: string, title: string) =>
      renameSpaceAction(engine.db, deviceId, spaceId, title),
    [engine, deviceId]
  );
  const setVisibility = useCallback(
    (spaceId: string, visibility: SpaceVisibility) =>
      setVisibilityAction(engine.db, {
        deviceId,
        accountId,
        spaceId,
        visibility,
      }),
    [engine, deviceId, accountId]
  );
  return { leaveSpace, endSpace, renameSpace, setVisibility, engine };
}

export function useSpaceActions() {
  const deviceId = useMyDeviceId();
  const profileId = useMyId();
  const accountId = useMyAccountId();
  const spacesDeps = useSpacesClientDeps();
  const host = useHostProfileSnapshot(profileId);
  const { leaveSpace, endSpace, renameSpace, setVisibility, engine } =
    useSpaceLifecycleMutations(deviceId, accountId);

  const createSpace = useCallback(
    async (
      onCreated?: (spaceId: string) => void,
      options?: CreateSpaceOptions
    ): Promise<string> => {
      const spaceId = crypto.randomUUID();
      await writeCreateSpaceAction(engine.db, {
        deviceId,
        profileId,
        deviceLabel: resolveCurrentDeviceLabel(deviceId),
        spaceId,
        visibility: options?.visibility ?? 'private',
        hostAccountId: accountId,
        ...host,
      });
      onCreated?.(spaceId);
      return spaceId;
    },
    [engine, deviceId, profileId, accountId, host]
  );

  const joinSpace = useCallback(
    async (
      spaceId: string,
      options?: {
        readonly inviteToken?: string | null;
      }
    ) => {
      await joinSpaceRemote(spacesDeps, {
        spaceId,
        deviceLabel: resolveCurrentDeviceLabel(deviceId),
        inviteToken: options?.inviteToken ?? null,
      });
    },
    [spacesDeps, deviceId]
  );

  return {
    createSpace,
    joinSpace,
    leaveSpace,
    endSpace,
    renameSpace,
    setVisibility,
  };
}
