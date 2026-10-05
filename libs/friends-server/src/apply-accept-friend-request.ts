import { acceptFriendRequestMutation } from '@libs/friends-shared/accept-friend-request-mutation';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

export async function applyAcceptFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await acceptFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
