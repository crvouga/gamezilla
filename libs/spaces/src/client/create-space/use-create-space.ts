import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useMyDeviceId, useMyId } from '@libs/auth/client/use-current-user';
import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { createSpaceWrite } from '../../shared/create-space/create-space-write';
import { resolveCurrentDeviceLabel } from '../resolve-device-label';

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

export function useCreateSpace() {
  const deviceId = useMyDeviceId();
  const profileId = useMyId();
  const writeContext = useWriteContext();
  const host = useHostProfileSnapshot(profileId);
  const engine = useSyncEngine();

  return useCallback(
    async (
      onCreated?: (spaceId: string) => void,
      options?: CreateSpaceOptions
    ): Promise<string> => {
      const spaceId = crypto.randomUUID();
      await runClientWrite(
        createSpaceWrite,
        writeContext,
        {
          spaceId,
          visibility: options?.visibility ?? 'private',
          deviceLabel: resolveCurrentDeviceLabel(deviceId),
          ...host,
        },
        engine.db
      );
      onCreated?.(spaceId);
      return spaceId;
    },
    [engine, writeContext, deviceId, host]
  );
}
