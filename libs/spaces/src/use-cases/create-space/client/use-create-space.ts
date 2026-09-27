import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import type { Decision } from '@libs/permissions/public/use-permissions';
import { useCreateId } from '@pkgs/uuid/solid';

import { createSpaceMutation } from '../shared/create-space-mutation';

/** A new space, or the hosting limit's decision (an invitation, not an error). */
export type CreateSpaceResult =
  | { readonly kind: 'created'; readonly spaceId: string }
  | { readonly kind: 'limited'; readonly decision: Decision };

function denialOf(meta: unknown): Decision | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const decision = (meta as { decision?: unknown }).decision;
  if (typeof decision !== 'object' || decision === null) return null;
  return decision as Decision;
}

export function useCreateSpace(): () => Promise<CreateSpaceResult> {
  const mutationClient = useMutationClient();
  const createId = useCreateId();

  return async () => {
    const spaceId = createId();
    const result = await mutationClient.mutate(createSpaceMutation, {
      spaceId,
    });
    if (result.ok) return { kind: 'created', spaceId };
    const decision = denialOf(result.failures[0]?.meta);
    if (decision !== null && !decision.allowed) {
      return { kind: 'limited', decision };
    }
    throw new Error(result.failures[0]?.message);
  };
}
