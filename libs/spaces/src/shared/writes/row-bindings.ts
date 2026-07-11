import {
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
} from '@libs/db/shared/space-tables';
import { spaceGuestMembershipEntityId } from '@libs/spaces/shared/membership-key';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import {
  createRowWriteBinding,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import { ownerMatches, readOne, readRowString } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { WriteStore } from '@pkgs/write/shared/write-store';

const spacesRowWrite = defineRowAuthorizeWrite({
  name: 'spaces.patch',
  authorize: async (ctx, row) => {
    const hostId = readRowString(row, SpaceCol.hostId);
    return ownerMatches(hostId, ctx.myId, 'SPACE_WRITE_DENIED') ?? ok(undefined);
  },
});

const spaceMembershipsRowWrite = defineRowAuthorizeWrite({
  name: 'space_memberships.patch',
  authorize: async (ctx, row) => {
    const guestId = readRowString(row, 'guest_id');
    return ownerMatches(guestId, ctx.myId, 'SPACE_MEMBERSHIP_GUEST_MISMATCH') ??
      ok(undefined);
  },
});

export const SPACE_ROW_BINDINGS: Readonly<Record<string, RowWriteBinding<RowChange>>> =
  {
    [SPACES_TABLE.tableName]: createRowWriteBinding(spacesRowWrite),
    [SPACE_MEMBERSHIPS_TABLE.tableName]: createRowWriteBinding(
      spaceMembershipsRowWrite
    ),
  };

export type JoinSpaceInput = { readonly spaceId: string };

async function readSpaceForJoin(
  store: WriteStore,
  spaceId: string
): Promise<
  | { readonly ok: true; readonly hostId: string; readonly endedAt: string | null }
  | { readonly ok: false; readonly code: string; readonly message: string }
> {
  const result = await readOne<{
    readonly host_id: string | null;
    readonly ended_at: string | null;
  }>(
    store,
    `SELECT ${SpaceCol.hostId}, ${SpaceCol.endedAt}
     FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.id} = ? LIMIT 1`,
    [spaceId],
    'SPACE_NOT_FOUND'
  );
  if (!result.ok) return result;
  const hostId = result.value.host_id;
  if (hostId === null || hostId.length === 0) {
    return { ok: false, code: 'SPACE_NOT_FOUND', message: 'Space not found' };
  }
  return { ok: true, hostId, endedAt: result.value.ended_at };
}

export const joinSpaceWrite = defineWrite<JoinSpaceInput, void>({
  name: 'spaces.join',
  parseInput: (raw) => {
    if (raw === null || typeof raw !== 'object') {
      return fail('INVALID_INPUT', 'join space input must be an object');
    }
    const spaceId = (raw as Record<string, unknown>)['spaceId'];
    if (typeof spaceId !== 'string' || spaceId.length === 0) {
      return fail('INVALID_INPUT', 'spaceId is required');
    }
    return ok({ spaceId });
  },
  authorize: async (ctx, input, store) => {
    const space = await readSpaceForJoin(store, input.spaceId);
    if (!space.ok) return fail(space.code, space.message);
    if (space.endedAt !== null) {
      return fail('SPACE_ENDED', 'Space has ended');
    }
    if (space.hostId === ctx.myId) {
      return fail('SPACE_HOST_ALREADY_MEMBER', 'Host is already in this space');
    }
    return ok(undefined);
  },
  execute: async (ctx, input, store) => {
    const now = new Date().toISOString();
    const membershipId = spaceGuestMembershipEntityId(ctx.myId, input.spaceId);
    await store.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (id, guest_id, space_id, joined_at, left_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT (id) DO UPDATE SET
         left_at = NULL,
         joined_at = excluded.joined_at`,
      [membershipId, ctx.myId, input.spaceId, now]
    );
    return ok(undefined);
  },
});

export async function authorizeJoinSpace(
  ctx: WriteContext,
  spaceId: string,
  store: WriteStore
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  return joinSpaceWrite.authorize(ctx, { spaceId }, store);
}
