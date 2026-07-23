import {
  SPACE_MEMBERSHIPS_TABLE,
  SPACE_PARTICIPATIONS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SpaceParticipationCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
  spaceParticipationEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import { shouldBumpMemberCountOnJoin } from '@libs/spaces/shared/participation/space-participation-policy';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { upsertSpaceMembershipRow } from '../space-row-upsert';
import {
  asObjectRecord,
  isoNow,
  migrateHostIdentity,
} from '../space-write-helpers';

export type ClaimSpaceParticipationsInput = Record<string, never>;

type MismatchedSeat = {
  readonly spaceId: string;
  readonly oldMemberId: string;
  readonly participationId: string;
};

function parseClaimInput(
  raw: unknown
): WriteResult<ClaimSpaceParticipationsInput> {
  if (raw === undefined || raw === null) {
    return ok({});
  }
  const record = asObjectRecord(raw, 'claim participations input');
  if (!record.ok) return record;
  return ok({});
}

async function listMismatchedSeats(
  sql: SqlClient,
  deviceId: string,
  currentMemberId: string
): Promise<readonly MismatchedSeat[]> {
  const rows = await sql.query<{
    readonly id: string;
    readonly space_id: string;
    readonly member_id: string;
  }>(
    `SELECT ${SpaceParticipationCol.id} AS id,
            ${SpaceParticipationCol.spaceId} AS space_id,
            ${SpaceParticipationCol.memberId} AS member_id
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.deviceId} = ?
       AND ${SpaceParticipationCol.leftAt} IS NULL
       AND ${SpaceParticipationCol.memberId} != ?`,
    [deviceId, currentMemberId]
  );
  return rows.map((row) => ({
    participationId: row.id,
    spaceId: row.space_id,
    oldMemberId: row.member_id,
  }));
}

async function bumpActiveMemberCount(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
  await sql.run(
    `UPDATE ${SPACES_TABLE.tableName}
     SET ${SpaceCol.activeMemberCount} = ${SpaceCol.activeMemberCount} + 1
     WHERE ${SpaceCol.id} = ?`,
    [spaceId]
  );
}

async function decrementActiveMemberCount(
  sql: SqlClient,
  spaceId: string
): Promise<void> {
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

async function upsertClaimMembership(
  sql: SqlClient,
  spaceId: string,
  memberId: string,
  now: string
): Promise<{ readonly reactivated: boolean }> {
  return upsertSpaceMembershipRow({
    sql,
    membershipId: spaceMembershipEntityId(memberId, spaceId),
    memberId,
    spaceId,
    now,
  });
}

async function softLeaveOldMembershipIfLast(
  sql: SqlClient,
  spaceId: string,
  oldMemberId: string,
  now: string
): Promise<void> {
  const remaining = await sql.query<{ readonly c: number | string }>(
    `SELECT COUNT(*) AS c
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.spaceId} = ?
       AND ${SpaceParticipationCol.memberId} = ?
       AND ${SpaceParticipationCol.leftAt} IS NULL`,
    [spaceId, oldMemberId]
  );
  if (Number(remaining[0]?.c ?? 0) > 0) return;
  const membershipId = spaceMembershipEntityId(oldMemberId, spaceId);
  const result = await sql.run(
    `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
     SET ${SpaceMembershipCol.leftAt} = ?
     WHERE ${SpaceMembershipCol.id} = ?
       AND ${SpaceMembershipCol.leftAt} IS NULL`,
    [now, membershipId]
  );
  if (result.changes > 0) {
    await decrementActiveMemberCount(sql, spaceId);
  }
}

async function claimOneSeat(args: {
  readonly ctx: WriteContext;
  readonly sql: SqlClient;
  readonly seat: MismatchedSeat;
  readonly currentMemberId: string;
  readonly now: string;
}): Promise<void> {
  const { ctx, sql, seat, currentMemberId, now } = args;
  const { reactivated } = await upsertClaimMembership(
    sql,
    seat.spaceId,
    currentMemberId,
    now
  );
  await sql.run(
    `UPDATE ${SPACE_PARTICIPATIONS_TABLE.tableName}
     SET ${SpaceParticipationCol.memberId} = ?
     WHERE ${SpaceParticipationCol.id} = ?`,
    [currentMemberId, seat.participationId]
  );
  await softLeaveOldMembershipIfLast(
    sql,
    seat.spaceId,
    seat.oldMemberId,
    now
  );
  if (shouldBumpMemberCountOnJoin({ membershipWasInactive: reactivated })) {
    await bumpActiveMemberCount(sql, seat.spaceId);
  }
  await migrateHostIdentity({
    sql,
    spaceId: seat.spaceId,
    deviceId: ctx.deviceId,
    newMemberId: currentMemberId,
    accountId: ctx.accountId,
  });
}

export async function authorizeClaimSpaceParticipations(
  _ctx: WriteContext,
  _input: ClaimSpaceParticipationsInput,
  _sql: SqlClient
): Promise<WriteResult<void>> {
  return ok(undefined);
}

export async function executeClaimSpaceParticipations(
  ctx: WriteContext,
  _input: ClaimSpaceParticipationsInput,
  sql: SqlClient
): Promise<WriteResult<void>> {
  const currentMemberId = resolveSpaceMemberId({
    accountId: ctx.accountId,
    deviceId: ctx.deviceId,
  });
  const seats = await listMismatchedSeats(sql, ctx.deviceId, currentMemberId);
  if (seats.length === 0) {
    return ok(undefined);
  }
  const now = isoNow();
  for (const seat of seats) {
    const expectedId = spaceParticipationEntityId(ctx.deviceId, seat.spaceId);
    if (seat.participationId !== expectedId) continue;
    await claimOneSeat({
      ctx,
      sql,
      seat,
      currentMemberId,
      now,
    });
  }
  return ok(undefined);
}

export const claimSpaceParticipationsWrite = defineWrite<
  ClaimSpaceParticipationsInput,
  void
>({
  name: 'spaces.claimParticipations',
  parseInput: parseClaimInput,
  authorize: authorizeClaimSpaceParticipations,
  execute: executeClaimSpaceParticipations,
});
