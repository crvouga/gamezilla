import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useCreateId } from '@pkgs/uuid/solid';
import type { SpaceVisibility } from '../../../shared/space/space-visibility';

import { createSpaceMutation } from '../shared/create-space-mutation';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

export function useCreateSpace() {
  const mutationClient = useMutationClient();
  const createId = useCreateId();

  return async (
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
  };
}
