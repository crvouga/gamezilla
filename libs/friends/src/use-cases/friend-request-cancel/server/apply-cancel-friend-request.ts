import type { SqlTx } from '@pkgs/sql-client/interface';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import { wrapMutationDb } from '@pkgs/sync-engine/shared';

import { cancelFriendRequestMutation } from '../shared/cancel-friend-request-mutation';

export async function applyCancelFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await cancelFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
