import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useCreateId } from '@pkgs/uuid';
import { useCallback } from 'react';

import { createSpaceMutation } from '../../shared/mutations/space-mutations';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

export function useCreateSpace() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();

  return useCallback(
    async (
      onCreated?: (spaceId: string) => void,
      options?: CreateSpaceOptions
    ): Promise<string> => {
      const spaceId = createId();
      const result = await mutationClient.mutate(createSpaceMutation, {
        spaceId,
        visibility: options?.visibility ?? ('private' as const),
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
      onCreated?.(spaceId);
      return spaceId;
    },
    [mutationClient, createId]
  );
}
