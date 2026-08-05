import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  createSpace,
  createSpaceBeforeBatch,
} from '../../shared/create-space/create-space-write';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

export function useCreateSpace() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();

  return useCallback(
    async (
      onCreated?: (spaceId: string) => void,
      options?: CreateSpaceOptions
    ): Promise<string> => {
      const spaceId = crypto.randomUUID();
      const input = {
        spaceId,
        visibility: options?.visibility ?? ('private' as const),
      };
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: createSpaceBeforeBatch(auth, input),
        fn: (tx) => createSpace(auth, input, tx),
      });
      onCreated?.(spaceId);
      return spaceId;
    },
    [auth, engine]
  );
}
