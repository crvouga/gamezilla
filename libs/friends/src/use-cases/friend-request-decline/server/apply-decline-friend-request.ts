import type { SqlTx } from '@pkgs/sql-client/interface';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import { wrapMutationDb } from '@pkgs/sync-engine/shared';

import { declineFriendRequestMutation } from '../shared/decline-friend-request-mutation';

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
