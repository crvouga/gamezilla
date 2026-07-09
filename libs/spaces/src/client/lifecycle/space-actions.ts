import { spaceGuestMembershipEntityId } from '@libs/spaces/shared/membership-key';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/spaces/shared/sync-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';

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

async function writeCreateSpaceAction(
  sql: SqlClient,
  myId: string,
  spaceId: string
): Promise<void> {
  const now = isoNow();
  await sql.run(
    `INSERT INTO ${SPACES_TABLE.tableName}
     (${SpaceCol.id}, ${SpaceCol.hostId}, ${SpaceCol.createdAt})
     VALUES (?, ?, ?)`,
    [spaceId, myId, now]
  );
}

async function joinSpaceAction(
  sql: SqlClient,
  myId: string,
  spaceId: string
): Promise<void> {
  const space = await readSpaceRow(sql, spaceId);
  if (space === null) {
    throw new Error('Space not found');
  }
  if (space.endedAt !== null) {
    throw new Error('Space has ended');
  }
  if (space.hostId === myId) {
    throw new Error('Host is already in this space');
  }
  const now = isoNow();
  const membershipId = spaceGuestMembershipEntityId(myId, spaceId);
  await sql.run(
    `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
     (${SpaceMembershipCol.id}, ${SpaceMembershipCol.guestId}, ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt}, ${SpaceMembershipCol.leftAt})
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT (${SpaceMembershipCol.id}) DO UPDATE SET
       ${SpaceMembershipCol.leftAt} = NULL,
       ${SpaceMembershipCol.joinedAt} = excluded.${SpaceMembershipCol.joinedAt}`,
    [membershipId, myId, spaceId, now]
  );
}

async function leaveSpaceAction(
  sql: SqlClient,
  myId: string,
  spaceId: string
): Promise<void> {
  const membershipId = spaceGuestMembershipEntityId(myId, spaceId);
  await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?`,
    [isoNow(), membershipId]
  );
}

async function endSpaceAction(
  sql: SqlClient,
  myId: string,
  spaceId: string
): Promise<void> {
  const space = await readSpaceRow(sql, spaceId);
  if (space === null || space.hostId !== myId) {
    throw new Error('Only the host can end this space');
  }
  const now = isoNow();
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.endedAt} = ?, ${SpaceCol.hostId} = ?
     WHERE ${SpaceCol.id} = ?`,
    [now, myId, spaceId]
  );
}

async function renameSpaceAction(
  sql: SqlClient,
  myId: string,
  spaceId: string,
  title: string
): Promise<void> {
  const space = await readSpaceRow(sql, spaceId);
  if (space === null || space.hostId !== myId) {
    throw new Error('Only the host can rename this space');
  }
  const trimmed = title.trim();
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.title} = ?, ${SpaceCol.hostId} = ?
     WHERE ${SpaceCol.id} = ?`,
    [trimmed.length > 0 ? trimmed : null, myId, spaceId]
  );
}

export function useSpaceActions() {
  const engine = useSyncEngine();
  const myId = useMyId();

  const createSpace = useCallback(
    async (onCreated?: (spaceId: string) => void): Promise<string> => {
      const spaceId = crypto.randomUUID();
      await writeCreateSpaceAction(engine.db, myId, spaceId);
      onCreated?.(spaceId);
      return spaceId;
    },
    [engine, myId]
  );

  const joinSpace = useCallback(
    async (spaceId: string) => joinSpaceAction(engine.db, myId, spaceId),
    [engine, myId]
  );

  const leaveSpace = useCallback(
    async (spaceId: string) => leaveSpaceAction(engine.db, myId, spaceId),
    [engine, myId]
  );

  const endSpace = useCallback(
    async (spaceId: string) => endSpaceAction(engine.db, myId, spaceId),
    [engine, myId]
  );

  const renameSpace = useCallback(
    async (spaceId: string, title: string) =>
      renameSpaceAction(engine.db, myId, spaceId, title),
    [engine, myId]
  );

  return {
    createSpace,
    joinSpace,
    leaveSpace,
    endSpace,
    renameSpace,
  };
}
