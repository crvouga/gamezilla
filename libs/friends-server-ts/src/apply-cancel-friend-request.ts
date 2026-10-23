import { cancelFriendRequestMutation } from '@libs/friends-shared-ts/cancel-friend-request-mutation';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';

export async function applyCancelFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await cancelFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
