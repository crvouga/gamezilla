/**
 * The spaces a decision case's person is in, seeded into the case's server
 * database or their device's, and the real spaces operations the space
 * tables are enforced at: the spaces mutations (replayed as the server
 * replays them) and the space room's command handler.
 */

import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import type { HarnessRoomGateway } from '@libs/harness-ts/composition';
import {
  countInput,
  DMN_INPUT,
  spacePresenceOf,
} from '@libs/permissions-shared-ts/people';
import type {
  ServerCase,
  ServerOperation,
} from '@libs/permissions-shared-ts/server';
import { OperationRefused } from '@libs/permissions-shared-ts/server';
import { spaceRoomGrants } from '@libs/spaces-server-ts/space-room-grants';
import { SelectGame } from '@libs/spaces-shared-ts/games';
import {
  spaceOpenSessionEntityId,
  spaceUserEntityId,
} from '@libs/spaces-shared-ts/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createInProcessRoomNode } from './in-process-room-node';
import { answerOfRoomCommand } from './room-command-probe';

/** Everything the spaces operations read and write, plus memberships. */
export const SPACE_TABLES = [...BILLING_TABLES, ...SPACES_TABLES, outboxEvents];

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
      id, space_id, user_id, created_by_account_id, joined, participation_revision,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${spaceUserEntityId(row.spaceId, row.userId)}, ${row.spaceId},
      ${row.userId}, ${null}, ${true}, ${0}, ${SEEDED_AT}, ${SEEDED_AT}, ${null}
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
 * On the person's device: the space as above, open on this device (they are
 * looking at it — what makes the app treat them as present when they are in
 * it).
 */
export async function seedPlaceInSpaceOnDevice(c: ServerCase): Promise<void> {
  await seedPlaceInSpace(c);
  await c.db.run(sql`
    INSERT INTO spaces_open_sessions (
      id, space_id, device_id, opened_at, join_announced, participation_revision,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${spaceOpenSessionEntityId(c.env.deviceId, SPACE_ID)}, ${SPACE_ID},
      ${c.env.deviceId}, ${SEEDED_AT}, ${true}, ${0}, ${SEEDED_AT}, ${SEEDED_AT},
      ${null}
    )
  `);
}

/**
 * Choosing the space's game: the person's device connects to the space's
 * room and sends the choice. The room node admits the connection with the
 * grants the room gateway decides for them from the case's server database
 * (spaces' `roomGrants`: their presence in the space, through the permission
 * system), and the room's gate refuses a choice made without the grant.
 */
export const chooseGame: ServerOperation = async (c) => {
  const { clock, timers } = createHarnessClock({ startMs: c.nowMs });
  let ids = 0;
  const gateway: HarnessRoomGateway = {
    roomGrants: ({ topic, actor }) =>
      spaceRoomGrants({ db: c.db, topic, actor, nowMs: c.nowMs }) ??
      Promise.resolve([]),
  };
  const node = createInProcessRoomNode(
    {
      clock,
      timers,
      createId: () => `room-id-${String(++ids)}`,
      random: () => 0.5,
      seed: 1n,
    },
    { games: [], gateway }
  );
  try {
    const answer = await answerOfRoomCommand(node, {
      spaceId: SPACE_ID,
      identity: memberIdOf(c),
      installId: c.env.deviceId,
      payload: SelectGame({ game: null }),
      commandId: 'choose-no-game',
      nowMs: c.nowMs,
      timers,
    });
    if (answer.kind === 'rejected') {
      throw new OperationRefused(answer.error.type);
    }
  } finally {
    node.dispose();
  }
};
