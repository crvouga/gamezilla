import type { SpacePresenceRole } from '@libs/permissions/public/permission-catalog';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { spaceUserEntityId } from './participation/participation-ids';
import { isSpaceHostActor } from './participation/space-participation-policy';

type SpaceHostRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
};

/** Who is asking, as the session resolved them. */
export type SpaceActor = {
  /** The space identity: the account, else the install. */
  readonly memberId: string;
  readonly accountId: string | null;
  readonly deviceId: string;
};

function hostsSpace(row: SpaceHostRow, actor: SpaceActor): boolean {
  const hostId = row.host_id ?? '';
  return isSpaceHostActor({
    hostId,
    hostMemberId: row.host_member_id ?? row.host_account_id ?? hostId,
    hostAccountId: row.host_account_id,
    memberId: actor.memberId,
    accountId: actor.accountId,
    deviceId: actor.deviceId,
  });
}

async function joinedSpace(
  db: Pick<SqlClient, 'query'>,
  spaceId: string,
  actor: SpaceActor
): Promise<boolean> {
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM spaces_users
    WHERE id = ${spaceUserEntityId(spaceId, actor.memberId)}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  return rows.length > 0;
}

/**
 * The actor's presence role in a space, from the stored rows: its host,
 * someone who joined it (a live `spaces_users` row), or nobody in it (`null`:
 * no space role — also when the space is not stored at all).
 */
export async function storedSpacePresence(
  db: Pick<SqlClient, 'query'>,
  spaceId: string,
  actor: SpaceActor
): Promise<SpacePresenceRole | null> {
  const rows = await db.query(sql<SpaceHostRow>`
    SELECT host_id, host_member_id, host_account_id
    FROM spaces WHERE id = ${spaceId} LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined || (row.host_id ?? '').length === 0) return null;
  if (hostsSpace(row, actor)) return 'host';
  return (await joinedSpace(db, spaceId, actor)) ? 'guest' : null;
}
