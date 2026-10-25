import { CLIENT_CONFIG_TABLES } from '@libs/app-config-shared-ts/tables';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { createMultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-creation';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared-ts/tables';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';
import { liveSessionRoom } from './reference-live-session-room';

export async function matchedProjection(
  definition: GameRegistration = continuousRaceGame
) {
  const rig = await liveSessionRoom(false, definition, true);
  const db = SqlClientImplBunSqlite.openMemory();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([
      ...MULTIPLAYER_TABLES,
      ...SPACES_TABLES,
      ...CLIENT_CONFIG_TABLES,
      ...BILLING_TABLES,
    ])
  );
  await reconcileSqliteSchema(db, matchmakingSchema);
  await reconcileOutbox(db);
  await prepareParticipantSpaces(db);
  const rules = createTurnGames([definition.registration]);
  const matched = definition.capabilities.matchmaking;
  if (matched === undefined)
    throw new Error('the projection fixture needs matchmaking');
  let sequence = 0;
  const createId = () => `projection-${++sequence}`;
  await createMultiplayerGame(
    db,
    {
      id: 'race-1',
      whiteId: 'alice',
      blackId: 'bob',
      rematchOf: null,
      timeControl: defaultMatchChoice(matched),
      nowMs: 0,
      createId,
    },
    rules
  );
  const rooms: RoomServicePort = {
    read: () => rig.server.readCommittedState(),
    send: (_topic, id, payload) =>
      rig.server.injectServiceCommand({
        id,
        payload,
        identity: ROOM_SERVICE_IDENTITY,
      }),
    setAvailability: (_topic, available) =>
      rig.server.setAvailability(available),
    disconnect: async (_topic, identity) =>
      rig.server.disconnectActor(identity),
    eraseIdentity: async (_topic, identity, replacement) =>
      rig.server.eraseIdentity({ identity, replacement }),
  };
  const env: MutationEnv = {
    rooms,
    turnGames: rules,
    actorId: 'alice',
    deviceId: 'phone',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date(rig.clock.now()),
    serverNow: () => new Date(rig.clock.now()),
    createId,
  };
  return {
    rig,
    db,
    env,
    rules,
    rooms,
    createId,
    stored: () => new MultiplayerGameRepository(db).byId('race-1'),
    dispose: async () => {
      rig.dispose();
      await db.disconnect();
    },
  };
}

async function prepareParticipantSpaces(
  db: SqlClientImplBunSqlite
): Promise<void> {
  for (const person of ['alice', 'bob']) {
    await db.run(sql`INSERT INTO spaces
      (id, title, host_id, host_member_id, host_account_id, visibility, created_at, updated_at, deleted_at)
      VALUES (${`${person}-space`}, ${`${person}'s space`}, ${person}, ${person}, ${person}, ${'private'},
        ${'1970-01-01T00:00:00.000Z'}, ${'1970-01-01T00:00:00.000Z'}, ${null})`);
  }
}
