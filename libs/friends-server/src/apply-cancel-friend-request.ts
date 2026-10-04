import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

import { cancelFriendRequestMutation } from '@libs/friends-shared/cancel-friend-request-mutation';

export async function applyCancelFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await cancelFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
