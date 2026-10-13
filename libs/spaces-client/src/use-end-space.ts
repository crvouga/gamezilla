import { endSpaceMutation } from '@libs/spaces-shared/end-space-mutation';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useHostingInvite } from './hosting-invite';
import { useHostingLimitInvite } from './hosting-limit-invite';

export function useEndSpace() {
  const mutationClient = useMutationClient();
  const invite = useHostingInvite();
  const limitInvite = useHostingLimitInvite();
  return async (spaceId: string) => {
    const result = await mutationClient.mutate(endSpaceMutation, { spaceId });
    if (!result.ok) throw new Error(result.failures[0]?.message);
    invite.clear();
    limitInvite.clear();
  };
}
