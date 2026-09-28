/**
 * The spaces a decision case's person is in, seeded into the case's server
 * database, and the real spaces operations the space tables are enforced
 * at: the spaces mutations (replayed as the server replays them) and the
 * space room's command handler.
 */

import { BILLING_TABLES } from '@libs/billing/public/schema';
import {
  countInput,
  DMN_INPUT,
  spacePresenceOf,
} from '@libs/permissions/root/conformance/people';
import {
  OperationRefused,
  type ServerCase,
  type ServerOperation,
} from '@libs/permissions/root/conformance/server';
import { SelectGame } from '@libs/spaces/public/games';
import { composeSpaceRoomModule } from '@libs/spaces/public/load-game-plugins';
import { spaceUserEntityId } from '@libs/spaces/public/participation/participation-ids';
import { SPACES_TABLES } from '@libs/spaces/public/schema';
import { sql } from '@pkgs/sql';

/** Everything the spaces operations read and write, plus memberships. */
export const SPACE_TABLES = [...BILLING_TABLES, ...SPACES_TABLES];

/** The space every space-roles case is about. */
export const SPACE_ID = 'the-space';

/** Someone else, who hosts the space when the person does not. */
const OTHER_HOST = 'someone-else';

const SEEDED_AT = '2026-09-19T08:00:00.000Z';

/** The id the person is known by in spaces (their account, else install). */
export function memberIdOf(c: ServerCase): string {
  return c.env.accountId ?? c.env.actorId;
}

async function insertSpace(
  c: ServerCase,
  space: { readonly id: string; readonly hostId: string }
): Promise<void> {
  const own = space.hostId === memberIdOf(c);
  const hostDevice = own ? c.env.deviceId : 'someone-device';
  const hostAccount = own ? c.env.accountId : space.hostId;
  await c.db.run(sql`
    INSERT INTO spaces (
      id, title, host_id, host_member_id, host_account_id, visibility,
      ended_at, created_at, updated_at, deleted_at
    ) VALUES (
      ${space.id}, ${null}, ${hostDevice}, ${space.hostId}, ${hostAccount},
      ${'public'}, ${null}, ${SEEDED_AT}, ${SEEDED_AT}, ${null}
    )
  `);
  await insertSpaceUser(c, { spaceId: space.id, userId: space.hostId });
}

async function insertSpaceUser(
  c: ServerCase,
  row: { readonly spaceId: string; readonly userId: string }
): Promise<void> {
  await c.db.run(sql`
    INSERT INTO spaces_users (
      id, space_id, user_id, created_by_account_id,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${spaceUserEntityId(row.spaceId, row.userId)}, ${row.spaceId},
      ${row.userId}, ${null}, ${SEEDED_AT}, ${SEEDED_AT}, ${null}
    )
  `);
}

/** The case's open spaces, each hosted by the person. */
export async function seedOpenSpaces(c: ServerCase): Promise<void> {
  const open = countInput(c.input, DMN_INPUT.open);
  for (let index = 0; index < open; index += 1) {
    await insertSpace(c, {
      id: `open-space-${String(index)}`,
      hostId: memberIdOf(c),
    });
  }
}

/** The space, hosted by the person, joined by them, or neither. */
export async function seedPlaceInSpace(c: ServerCase): Promise<void> {
  const presence = spacePresenceOf(c.input);
  const hostId = presence === 'host' ? memberIdOf(c) : OTHER_HOST;
  await insertSpace(c, { id: SPACE_ID, hostId });
  if (presence === 'guest') {
    await insertSpaceUser(c, { spaceId: SPACE_ID, userId: memberIdOf(c) });
  }
}

/**
 * Choosing the space's game: the space room's own command handler, sent the
 * choice by the person's room identity.
 */
export const chooseGame: ServerOperation = (c) => {
  const room = composeSpaceRoomModule([], () => c.nowMs);
  const result = room.handle(
    room.initialState(),
    { id: 'choose-game', ts: c.nowMs, payload: SelectGame({ game: null }) },
    memberIdOf(c)
  );
  if (!result.ok) {
    return Promise.reject(new OperationRefused(result.error.type));
  }
  return Promise.resolve();
};
