import { describe, expect, test } from 'bun:test';

import type { HarnessRoomGateway } from '@libs/harness-ts/composition';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { createInProcessRoomNode } from '@libs/spaces-harness-ts/in-process-room-node';
import { answerOfRoomCommand } from '@libs/spaces-harness-ts/room-command-probe';
import { spaceRoomGrants } from '@libs/spaces-server-ts/space-room-grants';
import { Increment } from '@libs/spaces-shared-ts/counter';
import { SelectGame } from '@libs/spaces-shared-ts/games';
import { spaceUserEntityId } from '@libs/spaces-shared-ts/participation-ids';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

const SPACE_ID = 'space-1';
const HOST = 'host-device';
const MEMBER = 'member-device';
const OUTSIDER = 'outsider-device';
const NOW = '2026-09-19T08:00:00.000Z';

async function seedSpace(db: SqlClient): Promise<void> {
  await db.run(sql`
    INSERT INTO spaces (
      id, title, host_id, host_member_id, host_account_id, visibility,
      ended_at, created_at, updated_at, deleted_at
    ) VALUES (
      ${SPACE_ID}, ${null}, ${HOST}, ${HOST}, ${null}, ${'public'},
      ${null}, ${NOW}, ${NOW}, ${null}
    )
  `);
  for (const userId of [HOST, MEMBER]) {
    await db.run(sql`
      INSERT INTO spaces_users (
        id, space_id, user_id, created_by_account_id,
        created_at, updated_at, joined, participation_revision, deleted_at
      ) VALUES (
        ${spaceUserEntityId(SPACE_ID, userId)}, ${SPACE_ID}, ${userId},
        ${null}, ${NOW}, ${NOW}, ${true}, ${0}, ${null}
      )
    `);
  }
}

/** `person`, on their own install, sends `payload` to the space's room. */
async function send(db: SqlClient, person: string, payload: Message) {
  const { clock, timers } = createHarnessClock({ startMs: Date.parse(NOW) });
  let ids = 0;
  const gateway: HarnessRoomGateway = {
    roomGrants: ({ topic, actor }) =>
      spaceRoomGrants({ db, topic, actor, nowMs: clock.now() }) ??
      Promise.resolve([]),
  };
  const env = {
    clock,
    timers,
    createId: () => `id-${String(++ids)}`,
    random: () => 0.5,
    seed: 1n,
  };
  const node = createInProcessRoomNode(env, { games: [], gateway });
  // Participant admission is meaningful only while the host is online.
  const host = node.createTransport({
    topic: `space:${SPACE_ID}`,
    module: 'space',
    apiUrl: '',
    identity: HOST,
    installId: HOST,
    clientId: 'host-presence',
    getSessionToken: () => null,
    clock,
    timers,
    random: env.random,
  });
  try {
    await host.connect();
    return await answerOfRoomCommand(node, {
      spaceId: SPACE_ID,
      identity: person,
      installId: person,
      payload,
      commandId: `choice-${person}`,
      nowMs: clock.now(),
      clock,
      timers,
    });
  } finally {
    host.destroy();
    node.dispose();
  }
}

async function withSpace(run: (db: SqlClient) => Promise<void>) {
  const db = await openConformanceDb(SPACES_TABLES);
  try {
    await seedSpace(db);
    await run(db);
  } finally {
    await db.disconnect();
  }
}

const chooseNoGame = SelectGame({ game: null });

describe('the game choice in a space room', () => {
  test('the host makes it', async () => {
    await withSpace(async (db) => {
      expect(await send(db, HOST, chooseNoGame)).toEqual({
        kind: 'committed',
      });
    });
  });

  // regression: space-game-choice-unguarded
  test('someone who joined is refused: only the host makes it', async () => {
    await withSpace(async (db) => {
      expect(await send(db, MEMBER, chooseNoGame)).toMatchObject({
        kind: 'rejected',
        error: { type: ROOM_ERROR_TYPE.unauthorized },
      });
    });
  });

  // regression: space-game-choice-unguarded
  test('someone not in the space is refused', async () => {
    await withSpace(async (db) => {
      expect(await send(db, OUTSIDER, chooseNoGame)).toMatchObject({
        kind: 'rejected',
        error: { type: ROOM_ERROR_TYPE.unauthorized },
      });
    });
  });

  // regression: space-preview-command-unguarded
  test('a public-link observer cannot issue a participant command', async () => {
    await withSpace(async (db) => {
      expect(await send(db, OUTSIDER, Increment({}))).toMatchObject({
        kind: 'rejected',
        error: { type: ROOM_ERROR_TYPE.unauthorized },
      });
      expect(await send(db, MEMBER, Increment({}))).toEqual({
        kind: 'committed',
      });
    });
  });
});
