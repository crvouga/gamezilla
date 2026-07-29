import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import {
  resolveSpaceMemberId,
  spaceMembershipEntityId,
} from '@libs/spaces/shared/participation/participation-ids';
import {
  isSpaceHostActor,
  shouldBumpMemberCountOnJoin,
} from '@libs/spaces/shared/participation/space-participation-policy';
import { honey } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import { ok, type WriteResult } from '@pkgs/write/shared/write-result';

import { upsertSpaceMembershipRow } from '../space-row-upsert';
import {
  asObjectRecord,
  isoNow,
  migrateHostIdentity,
  requireAccountId,
  requireNonEmptyString,
} from '../space-write-helpers';
import {
  authorizeJoinSpaceAccess,
  readSpaceRowForJoin,
} from './join-space-access';

export type JoinSpaceInput = {
  readonly spaceId: string;
};

function parseJoinSpaceInput(raw: unknown): WriteResult<JoinSpaceInput> {
  const record = asObjectRecord(raw, 'join space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

async function upsertJoinMembership(
  input: JoinSpaceInput,
  db: SqlClient,
  memberId: string
): Promise<{ readonly reactivated: boolean }> {
  return upsertSpaceMembershipRow({
    sql: db,
    membershipId: spaceMembershipEntityId(memberId, input.spaceId),
    memberId,
    spaceId: input.spaceId,
    now: isoNow(),
  });
}

async function bumpActiveMemberCount(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  await db.run(
    honey({
      update: SPACES_TABLE.tableName,
      set: {
        [SpaceCol.activeMemberCount]: ['+', SpaceCol.activeMemberCount, 1],
      },
      where: ['=', SpaceCol.id, spaceId],
    })
  );
}

export async function authorizeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  return authorizeJoinSpaceAccess(ctx, db, input.spaceId);
}

export async function executeJoinSpace(
  ctx: WriteContext,
  input: JoinSpaceInput,
  db: SqlClient
): Promise<WriteResult<void>> {
  const accountId = requireAccountId(ctx);
  if (!accountId.ok) return accountId;
  const memberId = resolveSpaceMemberId(accountId.value);
  const { reactivated } = await upsertJoinMembership(input, db, memberId);
  if (shouldBumpMemberCountOnJoin({ membershipWasInactive: reactivated })) {
    await bumpActiveMemberCount(db, input.spaceId);
  }
  const space = await readSpaceRowForJoin(db, input.spaceId);
  if (
    space.ok &&
    isSpaceHostActor({
      hostId: space.value.hostId,
      hostMemberId: space.value.hostMemberId,
      hostAccountId: space.value.hostAccountId,
      memberId,
      accountId: accountId.value,
      deviceId: ctx.deviceId,
    })
  ) {
    await migrateHostIdentity({
      sql: db,
      spaceId: input.spaceId,
      deviceId: ctx.deviceId,
      newMemberId: memberId,
      accountId: accountId.value,
    });
  }
  return ok(undefined);
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: parseJoinSpaceInput,
  authorize: authorizeJoinSpace,
  execute: executeJoinSpace,
});
