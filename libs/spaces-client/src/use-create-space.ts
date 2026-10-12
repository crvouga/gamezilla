import { useLimitDecision } from '@libs/permissions-client/use-can';
import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { createSpaceMutation } from '@libs/spaces-shared/create-space-mutation';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { useSpaceAdmissionsInFlight } from './space-admissions-in-flight';
import { useHostedSpaceCount } from './use-hosted-space-count';

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
  const admissions = useSpaceAdmissionsInFlight();
  const hosted = useHostedSpaceCount();
  // What this device knows now. A membership it could not confirm past grace
  // no longer lifts the limit, although its synced row still reads as paid.
  const limit = useLimitDecision(LIMIT.hostedSpaces, hosted.count);

  return async () => {
    const known = limit();
    if (!known.allowed) return { kind: 'limited', decision: known };
    const spaceId = createId();
    const result = await mutationClient.mutate(createSpaceMutation, {
      spaceId,
    });
    if (result.ok) {
      // The room opens once this reaches the server (host grants).
      admissions?.record(spaceId, result.mutationId);
      return { kind: 'created', spaceId };
    }
    const decision = denialOf(result.failures[0]?.meta);
    if (decision !== null && !decision.allowed) {
      return { kind: 'limited', decision };
    }
    throw new Error(result.failures[0]?.message);
  };
}
