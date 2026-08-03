import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export const SPACES_TABLE = 'spaces';
export const SPACE_USERS_TABLE = 'space_users';

export type SpaceHostRow = {
  readonly host_id: string | null;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
  readonly visibility: string | null;
};

export async function querySpaceById(
  db: Pick<SqlClient, 'query'>,
  spaceId: string
): Promise<SpaceHostRow | null> {
  const rows = await db.query(sql<SpaceHostRow>`
    SELECT host_id, host_member_id, host_account_id, ended_at, visibility
    FROM spaces
    WHERE id = ${spaceId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function spaceUserExists(
  db: Pick<SqlClient, 'query'>,
  spaceId: string,
  userId: string
): Promise<boolean> {
  if (spaceId.length === 0 || userId.length === 0) return false;
  const id = `${spaceId}:${userId}`;
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM space_users WHERE id = ${id} LIMIT 1
  `);
  return rows[0] !== undefined;
}

export function resolveHostMemberId(row: SpaceHostRow): string | null {
  const hostId = row.host_id;
  if (hostId === null || hostId.length === 0) return null;
  return row.host_member_id ?? row.host_account_id ?? hostId;
}

export function readStringValue(
  values: Readonly<Record<string, unknown>> | undefined,
  key: string
): string | undefined {
  const raw = values?.[key];
  return typeof raw === 'string' ? raw : undefined;
}

export function spaceIdFromUsersRowId(rowId: string): string | null {
  const sep = rowId.indexOf(':');
  if (sep <= 0) return null;
  return rowId.slice(0, sep);
}
