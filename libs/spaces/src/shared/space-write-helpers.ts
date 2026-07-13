import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { spaceDeviceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { fail, ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { readOne } from '@pkgs/write/shared/read-row-values';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export function isoNow(): string {
  return new Date().toISOString();
}

export type SpaceHostEnded = {
  readonly hostId: string;
  readonly endedAt: string | null;
};

export async function readSpaceHostEnded(
  sql: SqlClient,
  spaceId: string
): Promise<WriteResult<SpaceHostEnded>> {
  const result = await readOne<{
    readonly host_id: string | null;
    readonly ended_at: string | null;
  }>(
    sql,
    `SELECT ${SpaceCol.hostId}, ${SpaceCol.endedAt}
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ? LIMIT 1`,
    [spaceId],
    'SPACE_NOT_FOUND'
  );
  if (!result.ok) return result;
  const hostId = result.value.host_id;
  if (hostId === null || hostId.length === 0) {
    return fail('SPACE_NOT_FOUND', 'Space not found');
  }
  return ok({ hostId, endedAt: result.value.ended_at });
}

export async function authorizeSpaceHost(
  ctx: WriteContext,
  sql: SqlClient,
  spaceId: string,
  deniedMessage: string
): Promise<WriteResult<void>> {
  const space = await readSpaceHostEnded(sql, spaceId);
  if (!space.ok) return space;
  if (space.value.hostId !== ctx.deviceId) {
    return fail('SPACE_HOST_REQUIRED', deniedMessage);
  }
  return ok(undefined);
}

export type MembershipLeaveRow = {
  readonly leftAt: string | null;
  readonly guestId: string;
};

export async function readMembershipForLeave(
  sql: SqlClient,
  deviceId: string,
  spaceId: string
): Promise<MembershipLeaveRow | null> {
  const membershipId = spaceDeviceMembershipEntityId(deviceId, spaceId);
  const rows = await sql.query<{
    readonly left_at: string | null;
    readonly guest_id: string | null;
  }>(
    `SELECT ${SpaceMembershipCol.leftAt} AS left_at,
            ${SpaceMembershipCol.guestId} AS guest_id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [membershipId]
  );
  const row = rows[0];
  if (row === undefined) return null;
  const guestId = row.guest_id;
  if (guestId === null || guestId.length === 0) return null;
  return { leftAt: row.left_at, guestId };
}

export function requireNonEmptyString(
  value: unknown,
  field: string
): WriteResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail('INVALID_INPUT', `${field} is required`);
  }
  return ok(value);
}

export function asObjectRecord(
  raw: unknown,
  label: string
): WriteResult<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', `${label} must be an object`);
  }
  return ok(raw as Record<string, unknown>);
}
