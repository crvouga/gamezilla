import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useCreateId } from '@pkgs/uuid-client/solid';

import { useSpaceHostingsInFlight } from './space-hostings-in-flight';

import { createSpaceMutation } from '@libs/spaces-shared/create-space-mutation';

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
  const hostings = useSpaceHostingsInFlight();

  return async () => {
    const spaceId = createId();
    const result = await mutationClient.mutate(createSpaceMutation, {
      spaceId,
    });
    if (result.ok) {
      // The room opens once this reaches the server (host grants).
      hostings?.record(spaceId, result.mutationId);
      return { kind: 'created', spaceId };
    }
    const decision = denialOf(result.failures[0]?.meta);
    if (decision !== null && !decision.allowed) {
      return { kind: 'limited', decision };
    }
    throw new Error(result.failures[0]?.message);
  };
}
