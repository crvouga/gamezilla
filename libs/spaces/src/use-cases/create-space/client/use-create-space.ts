import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useCreateId } from '@pkgs/uuid/solid';
import type { SpaceVisibility } from '../../../shared/space/space-visibility';

import { createSpaceMutation } from '../shared/create-space-mutation';

export type CreateSpaceOptions = {
  /**
   * Default `public`: anyone with the link may join, a guest included
   * (docs/GOAL.md §2). Public is not listed — strangers find a space only
   * through its link; friends see it in their lobby either way.
   */
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
      visibility: options?.visibility ?? ('public' as const),
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
    onCreated?.(spaceId);
    return spaceId;
  };
}
