import { runClientWrite } from '@pkgs/write/client/run-client-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertUuid } from '@pkgs/uuid';

import { ensureProfileLocalWrite } from '../../shared/ensure-profile-local/ensure-profile-local-write';

/**
 * Ensures a local `profiles` row exists for `writeContext.myId` (install id
 * when anonymous, account id when signed in). Username is assigned online via
 * `POST /profile/ensure` — this only seeds id / avatar for the sync path.
 */
export async function ensureProfile(
  sql: SqlClient,
  writeContext: WriteContext,
  profileId: string = writeContext.myId
): Promise<void> {
  assertUuid(profileId, 'ensureProfile profileId');
  await runClientWrite(
    ensureProfileLocalWrite,
    writeContext,
    { profileId },
    sql
  );
}
