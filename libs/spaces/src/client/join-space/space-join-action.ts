import type { SqlClient } from '@pkgs/sql-client/interface';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { joinSpaceWrite } from '../../shared/join-space/join-space-write';

export async function joinSpaceAction(
  sql: SqlClient,
  writeContext: WriteContext,
  args: {
    readonly spaceId: string;
    readonly inviteToken: string | null;
  }
): Promise<void> {
  await runClientWrite(joinSpaceWrite, writeContext, args, sql);
}
