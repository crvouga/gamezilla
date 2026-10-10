import { joinSpaceMutation } from '@libs/spaces-shared/join-space-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useSpaceAdmissionsInFlight } from './space-admissions-in-flight';

export function useJoinSpace() {
  const mutationClient = useMutationClient();
  const admissions = useSpaceAdmissionsInFlight();

  return async (spaceId: string) => {
    const result = await mutationClient.mutate(joinSpaceMutation, {
      spaceId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
    admissions?.record(spaceId, result.mutationId);
  };
}
