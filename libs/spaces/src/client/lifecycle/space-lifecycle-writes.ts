import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

function isoNow(): string {
  return new Date().toISOString();
}

async function readSpaceRow(
  sql: SqlClient,
  spaceId: string
): Promise<{ hostId: string; endedAt: string | null } | null> {
  const rows = await sql.query<{
    readonly host_id: string | null;
    readonly ended_at: string | null;
  }>(
    `SELECT ${SpaceCol.hostId}, ${SpaceCol.endedAt}
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ? LIMIT 1`,
    [spaceId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  const hostId = row.host_id;
  if (hostId === null || hostId.length === 0) return null;
  return { hostId, endedAt: row.ended_at };
}

export async function writeCreateSpaceAction(
  sql: SqlClient,
  args: {
    readonly deviceId: string;
    readonly profileId: string;
    readonly deviceLabel: string;
    readonly spaceId: string;
    readonly visibility: SpaceVisibility;
    readonly hostAccountId: string | null;
    readonly hostUsername: string | null;
    readonly hostAvatarConfig: string | null;
  }
): Promise<void> {
  const now = isoNow();
  const visibility =
    args.hostAccountId === null && args.visibility !== 'private'
      ? 'private'
      : args.visibility;
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.createdAt},
      ${SpaceCol.visibility}, ${SpaceCol.hostAccountId},
      ${SpaceCol.hostUsername}, ${SpaceCol.hostAvatarConfig},
      ${SpaceCol.activeMemberCount})
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      args.spaceId,
      args.deviceId,
      now,
      visibility,
      args.hostAccountId,
      args.hostUsername,
      args.hostAvatarConfig,
    ]
  );
  const membershipId = spaceDeviceMembershipEntityId(
    args.deviceId,
    args.spaceId
  );
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.guestId},
      ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
      ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId},
      ${SpaceMembershipCol.deviceLabel})
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [
      membershipId,
      args.deviceId,
      args.spaceId,
      now,
      args.profileId,
      args.deviceLabel,
    ]
  );
}

export async function leaveSpaceAction(
  sql: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<void> {
  const membershipId = spaceDeviceMembershipEntityId(deviceId, spaceId);
  const rows = await sql.query<{ readonly left_at: string | null }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const prev = rows[0];
  if (prev === undefined || prev.left_at !== null) return;
  await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?`,
    [isoNow(), membershipId]
  );
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.activeMemberCount} = CASE
       WHEN ${SpaceCol.activeMemberCount} > 0
       THEN ${SpaceCol.activeMemberCount} - 1
       ELSE 0 END
     WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
}

export async function endSpaceAction(
  sql: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<void> {
  const space = await readSpaceRow(sql, spaceId);
  if (space === null || space.hostId !== deviceId) {
    throw new Error('Only the host can end this space');
  }
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.endedAt} = ?, ${SpaceCol.hostId} = ?
     WHERE ${SpaceCol.id} = ?`,
    [isoNow(), deviceId, spaceId]
  );
}

export async function renameSpaceAction(
  sql: SqlClient,
  deviceId: string,
  spaceId: string,
  title: string
): Promise<void> {
  const space = await readSpaceRow(sql, spaceId);
  if (space === null || space.hostId !== deviceId) {
    throw new Error('Only the host can rename this space');
  }
  const trimmed = title.trim();
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.title} = ?, ${SpaceCol.hostId} = ?
     WHERE ${SpaceCol.id} = ?`,
    [trimmed.length > 0 ? trimmed : null, deviceId, spaceId]
  );
}

export async function setVisibilityAction(
  sql: SqlClient,
  args: {
    readonly deviceId: string;
    readonly accountId: string | null;
    readonly spaceId: string;
    readonly visibility: SpaceVisibility;
  }
): Promise<void> {
  const space = await readSpaceRow(sql, args.spaceId);
  if (space === null || space.hostId !== args.deviceId) {
    throw new Error('Only the host can change visibility');
  }
  if (args.visibility !== 'private' && args.accountId === null) {
    throw new Error('Sign in to make a space public or friends-only');
  }
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.visibility} = ?, ${SpaceCol.hostId} = ?
     WHERE ${SpaceCol.id} = ?`,
    [args.visibility, args.deviceId, args.spaceId]
  );
}
