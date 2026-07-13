import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { resolveCurrentDeviceLabel } from '../resolve-device-label';
import { useSpacesClientDeps } from '../use-spaces-client-deps';
import { joinSpaceAction } from './space-join-action';

export function useJoinSpace() {
  const deviceId = useMyDeviceId();
  const writeContext = useWriteContext();
  const spacesDeps = useSpacesClientDeps();
  const engine = useSyncEngine();

  return useCallback(
    async (
      spaceId: string,
      options?: {
        readonly inviteToken?: string | null;
      }
    ) => {
      await joinSpaceAction(engine.db, writeContext, spacesDeps, {
        spaceId,
        deviceLabel: resolveCurrentDeviceLabel(deviceId),
        inviteToken: options?.inviteToken ?? null,
      });
    },
    [engine, writeContext, spacesDeps, deviceId]
  );
}
