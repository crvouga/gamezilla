import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useMyDeviceId } from '@libs/auth/client/use-current-user';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { createSpaceWrite } from '../../shared/create-space/create-space-write';
import { resolveCurrentDeviceLabel } from '../resolve-device-label';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

export function useCreateSpace() {
  const deviceId = useMyDeviceId();
  const writeContext = useWriteContext();
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
        },
        engine.db
      );
      onCreated?.(spaceId);
      return spaceId;
    },
    [engine, writeContext, deviceId]
  );
}
