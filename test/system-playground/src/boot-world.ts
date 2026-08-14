// @io-wall-ok
/**
 * Boot an in-process World (API + rooms + sqlite + pubsub) for the Expo web playground.
 */

import type { OpenRequestDb } from '@apps/api/db/open-request-db';
import { apiResource } from '@apps/api/system/api-resource';
import { roomResource } from '@apps/room/system/room-resource';
import { system } from '@libs/runtime/shared/system';
import { wallClock, wallTimers } from '@pkgs/clock';
import type { Io } from '@pkgs/io';
import { wallIo } from '@pkgs/io';
import {
  createInMemoryBus,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplExpoSqlite } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import { createWorld, type Fetch, type World } from '@pkgs/system';
import {
  migrateSimSqlite,
  SIM_API_URL,
} from '@test/ui/setup/migrate-sim-sqlite';
import {
  type ActorClientSeams,
  createActorClientSeams,
} from '@test/ui/setup/sim-actor-overrides';

import { createPlaygroundProvide } from './playground-provide';

export type PlaygroundActor = {
  readonly id: string;
  readonly io: Io;
  readonly seams: ActorClientSeams;
};

export type PlaygroundWorld = {
  readonly world: World;
  readonly apiFetch: Fetch;
  readonly pubSubBus: InMemoryBus;
  readonly actors: {
    readonly alice: PlaygroundActor;
    readonly bob: PlaygroundActor;
  };
  dispose(): Promise<void>;
};

function openRequestDbFor(sqlClient: SqlClient): OpenRequestDb {
  return async () => ({
    kind: 'sqlite',
    sqlClient,
  });
}

async function openExpoSql(name: string): Promise<SqlClientImplExpoSqlite> {
  return SqlClientImplExpoSqlite.open(name, wallTimers);
}

function makeActorIo(apiFetch: Fetch): Io {
  const base = wallIo();
  return {
    ...base,
    http: {
      fetch: (input, init) => apiFetch(input, init),
    },
  };
}

export async function bootPlaygroundWorld(): Promise<PlaygroundWorld> {
  const pubSubBus = createInMemoryBus();
  const apiSql = await openExpoSql('sim_api');
  await migrateSimSqlite({
    sqlClient: apiSql,
    io: {
      ...wallIo(),
      clock: wallClock,
      timers: wallTimers,
    },
  });
  const openRequestDb = openRequestDbFor(apiSql);

  const world = createWorld(system, {
    seed: 1,
    timers: wallTimers,
    impls: [apiResource, roomResource],
    provide: createPlaygroundProvide({
      sqlClient: apiSql,
      openRequestDb,
      pubSubBus,
    }),
    startMs: wallClock.now(),
  });

  const apiFetch = await world.spawn<Fetch>('api');

  const makeSeams = (id: string): ActorClientSeams =>
    createActorClientSeams({
      apiUrl: SIM_API_URL,
      pubSubBus,
      nodeId: id,
      openSqlClient: async () => openExpoSql(`sim_${id}`),
    });

  const aliceSeams = makeSeams('alice');
  const bobSeams = makeSeams('bob');

  const actors = {
    alice: {
      id: 'alice',
      io: makeActorIo(apiFetch),
      seams: aliceSeams,
    },
    bob: {
      id: 'bob',
      io: makeActorIo(apiFetch),
      seams: bobSeams,
    },
  } as const;

  return {
    world,
    apiFetch,
    pubSubBus,
    actors,
    async dispose() {
      aliceSeams.disposeSqlite();
      bobSeams.disposeSqlite();
      world.dispose();
      await apiSql.disconnect();
    },
  };
}
