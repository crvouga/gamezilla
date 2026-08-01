import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import {
  authorizeJoinSpace,
  executeJoinSpace,
  joinSpaceBeforeBatch,
} from '../../shared/join-space/join-space-write';

export async function joinSpaceAction(
  sql: SqlClient,
  auth: AppRulesAuth,
  args: {
    readonly spaceId: string;
  },
  onJoined?: (spaceId: string) => void
): Promise<void> {
  await authorizeJoinSpace(auth, args, sql);
  await validatedWrite({
    sql,
    auth,
    rules: SPACE_RULES,
    beforeBatch: joinSpaceBeforeBatch(auth, args),
    fn: (tx) => executeJoinSpace(auth, args, tx),
  });
  onJoined?.(args.spaceId);
}
