import type { SqlTx } from '@pkgs/sql-client/interface';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import { wrapMutationDb } from '@pkgs/sync-engine/shared';

import { acceptFriendRequestMutation } from '../shared/accept-friend-request-mutation';

export async function applyAcceptFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await acceptFriendRequestMutation.run({ tx: wrapped.tx, env }, { requestId });
}
