import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

import { declineFriendRequestMutation } from '@libs/friends-shared/decline-friend-request-mutation';

export async function applyDeclineFriendRequest(
  tx: SqlTx,
  env: MutationEnv,
  requestId: string
): Promise<void> {
  const wrapped = wrapMutationDb(tx, env);
  await declineFriendRequestMutation.run(
    { tx: wrapped.tx, env },
    { requestId }
  );
}
