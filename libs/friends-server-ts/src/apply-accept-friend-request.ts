import { acceptFriendRequestMutation } from '@libs/friends-shared-ts/accept-friend-request-mutation';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';

export async function applyAcceptFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await acceptFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
