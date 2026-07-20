import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { resolveCurrentDeviceLabel } from '../resolve-device-label';
import { joinSpaceAction } from './space-join-action';

export function useJoinSpace() {
  const deviceId = useMyDeviceId();
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    async (
      spaceId: string,
      options?: {
        readonly inviteToken?: string | null;
      }
    ) => {
      await joinSpaceAction(engine.db, writeContext, {
        spaceId,
        deviceLabel: resolveCurrentDeviceLabel(deviceId),
        inviteToken: options?.inviteToken ?? null,
      });
    },
    [engine, writeContext, deviceId]
  );
}
