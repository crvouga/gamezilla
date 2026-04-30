import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import { PatchDbImplClientTransport } from '../impl-client-transport';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import {
  SYNC_ERROR_TOPIC,
  type SyncErrorEvent,
  SyncPatchesDb,
} from '../impl-sync';
import type { PatchesDb } from '../interface';
import { DeterministicScheduler } from './deterministic-scheduler';
import {
  SimEventRecorder,
  type SimRecordingMeta,
  isPatchDbAppEnabled,
  summarizePatchInputs,
} from './event-recorder';
import { NetworkLink } from './network-link';
import { NotifyingPatchesDb } from './notifying-patches-db';
import {
  type SimServerPort,
  simServerPortFromPubSub,
} from './server-port';
import { Sim } from './sim';
import type {
  ClientRuntime,
  ScenarioClientSpec,
  ScenarioServerSpec,
  ServerRuntime,
  SimClient,
  SimLink,
  SimServer,
} from './sim-types';
import { SimulatedPatchDbClientTransport } from './simulated-client-transport';

const SYNC_SUBSCRIPTION_MICROTASK_ROUNDS = 32;

async function flushSyncSubscriptionMicrotasks(
  rounds: number = SYNC_SUBSCRIPTION_MICROTASK_ROUNDS
): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

function createSimLink(link: NetworkLink): SimLink {
  return {
    partition: () => link.setPartitioned(true),
    heal: () => link.setPartitioned(false),
    failNextRead: (err?: Error) =>
      link.failNextReadWith(err ?? new Error('simulated read failure')),
    failNextWrite: (err?: Error) =>
      link.failNextWriteWith(err ?? new Error('simulated write failure')),
    setLatency: (ms: number) => link.setReadWriteLatencyMs(ms),
    getLatency: () => link.getReadWriteLatencyMs(),
    setInvalidationLatency: (ms: number) => link.setInvalidationLatencyMs(ms),
    isPartitioned: () => link.isPartitioned(),
  };
}

function wrapServerDbForViz(
  serverId: string,
  inner: PatchDbImplSqlite,
  recorder: SimEventRecorder,
  getTime: () => number
): PatchesDb {
  return {
    get hooks() {
      return inner.hooks;
    },
    get compaction() {
      return inner.compaction;
    },
    read: (queries, ctx) => inner.read(queries, ctx),
    write: async (patches, ctx) => {
      recorder.emit({
        type: 'server_write',
        serverId,
        summaries: summarizePatchInputs(patches),
        patchCount: patches.length,
        time: getTime(),
      });
      return inner.write(patches, ctx);
    },
    update: (updates, ctx) => inner.update(updates, ctx),
  };
}

async function createServerRuntime(
  spec: ScenarioServerSpec
): Promise<ServerRuntime> {
  const sql = SqlClientImplBunSqlite.open(':memory:');
  await sql.connect();
  const backing = new PatchDbImplSqlite(sql);
  await backing.migrate();
  const pubSub = new InMemoryPubSub();

  const notifying = new NotifyingPatchesDb(backing, pubSub);
  const port: SimServerPort = simServerPortFromPubSub(
    (q, ctx) => notifying.read(q, ctx),
    (p, ctx) => notifying.write(p, ctx),
    pubSub
  );

  return { id: spec.id, sql, backing, pubSub, port };
}

type CreateClientRuntimeOptions = {
  spec: ScenarioClientSpec;
  server: ServerRuntime;
  scheduler: DeterministicScheduler;
  recorder: SimEventRecorder | null;
};

async function createClientRuntime(
  options: CreateClientRuntimeOptions
): Promise<ClientRuntime> {
  const { spec, server, scheduler, recorder } = options;
  const sql = SqlClientImplBunSqlite.open(':memory:');
  await sql.connect();
  const local = new PatchDbImplSqlite(sql);
  await local.migrate();

  const link = new NetworkLink(
    scheduler,
    recorder ? { recorder, clientId: spec.id } : undefined
  );
  const transport = new SimulatedPatchDbClientTransport(
    server.port,
    link,
    recorder
      ? {
          recorder,
          clientId: spec.id,
          getTime: () => scheduler.now(),
        }
      : undefined
  );
  const remotePatchesDb = new PatchDbImplClientTransport(transport);
  const pubSub = new InMemoryPubSub();

  const syncDb = new SyncPatchesDb(local, remotePatchesDb, pubSub, {
    pushDriver: 'manual',
    pollDriver: 'manual',
    pushIntervalMs: 10,
    logPushPollFailures: false,
  });

  const cr: ClientRuntime = {
    id: spec.id,
    serverId: spec.serverId,
    sqlClient: sql,
    localDb: local,
    transport,
    remoteDb: remotePatchesDb,
    syncDb,
    pubSub,
    link,
    vizUnsubs: [],
  };

  if (recorder) {
    cr.vizUnsubs.push(
      pubSub.subscribe(SYNC_ERROR_TOPIC, (msg: unknown) => {
        const e = msg as SyncErrorEvent;
        recorder.emit({
          type: 'sync_error',
          clientId: spec.id,
          source: e.source,
          errorMessage:
            e.error instanceof Error ? e.error.message : String(e.error),
          time: scheduler.now(),
        });
      })
    );
  }

  return cr;
}

type ClientHandleContext = {
  runtime: ClientRuntime;
  recorder: SimEventRecorder | null;
  scheduler: DeterministicScheduler;
};

function buildClientWrite(
  ctx: ClientHandleContext
): SimClient['write'] {
  const { runtime, recorder, scheduler } = ctx;
  return async (patches) => {
    if (recorder) {
      recorder.emit({
        type: 'client_write',
        clientId: runtime.id,
        summaries: summarizePatchInputs(patches),
        patchCount: patches.length,
        time: scheduler.now(),
      });
    }
    return runtime.syncDb.write(patches);
  };
}

function buildClientPush(ctx: ClientHandleContext): SimClient['push'] {
  const { runtime, recorder, scheduler } = ctx;
  return async () => {
    if (recorder) {
      recorder.emit({
        type: 'push_start',
        clientId: runtime.id,
        time: scheduler.now(),
      });
    }
    try {
      await runtime.syncDb.runPushNow();
      if (recorder) {
        recorder.emit({
          type: 'push_success',
          clientId: runtime.id,
          time: scheduler.now(),
        });
      }
    } catch (e) {
      if (recorder) {
        recorder.emit({
          type: 'push_fail',
          clientId: runtime.id,
          errorMessage: e instanceof Error ? e.message : String(e),
          time: scheduler.now(),
        });
      }
      throw e;
    }
    await flushSyncSubscriptionMicrotasks();
  };
}

function buildClientPoll(ctx: ClientHandleContext): SimClient['poll'] {
  const { runtime, recorder, scheduler } = ctx;
  return async () => {
    if (recorder) {
      recorder.emit({
        type: 'poll_start',
        clientId: runtime.id,
        time: scheduler.now(),
      });
    }
    try {
      await runtime.syncDb.runPollNow();
      if (recorder) {
        recorder.emit({
          type: 'poll_success',
          clientId: runtime.id,
          time: scheduler.now(),
        });
      }
    } catch (e) {
      if (recorder) {
        recorder.emit({
          type: 'poll_fail',
          clientId: runtime.id,
          errorMessage: e instanceof Error ? e.message : String(e),
          time: scheduler.now(),
        });
      }
      throw e;
    }
    await flushSyncSubscriptionMicrotasks();
  };
}

function buildSubscribe(
  ctx: ClientHandleContext,
  mode: 'patches' | 'entities'
): SimClient['subscribe']['patches'] {
  const { runtime, recorder, scheduler } = ctx;
  return (query, listener) => {
    if (recorder) {
      recorder.emit({
        type: 'subscribe',
        clientId: runtime.id,
        mode,
        queryKey: JSON.stringify(query),
        time: scheduler.now(),
      });
    }
    const inner =
      mode === 'patches'
        ? runtime.syncDb.subscribe.patches(query, listener)
        : runtime.syncDb.subscribe.entities(
            query,
            listener as Parameters<
              SyncPatchesDb['subscribe']['entities']
            >[1]
          );
    return () => {
      if (recorder) {
        recorder.emit({
          type: 'unsubscribe',
          clientId: runtime.id,
          mode,
          queryKey: JSON.stringify(query),
          time: scheduler.now(),
        });
      }
      inner();
    };
  };
}

function createClientHandle(ctx: ClientHandleContext): SimClient {
  const { runtime } = ctx;
  return {
    id: runtime.id,
    write: buildClientWrite(ctx),
    read: (queries) => runtime.syncDb.read(queries),
    push: buildClientPush(ctx),
    poll: buildClientPoll(ctx),
    subscribe: {
      patches: buildSubscribe(ctx, 'patches'),
      entities: buildSubscribe(
        ctx,
        'entities'
      ) as SimClient['subscribe']['entities'],
    },
    wipeStorage: async () => {
      await runtime.sqlClient.run('DELETE FROM patches');
      await runtime.sqlClient.run('DELETE FROM snapshots');
    },
    link: createSimLink(runtime.link),
    syncDb: runtime.syncDb,
  };
}

function createServerHandle(
  runtime: ServerRuntime,
  recorder: SimEventRecorder | null,
  scheduler: DeterministicScheduler
): SimServer {
  const db =
    recorder !== null
      ? wrapServerDbForViz(
          runtime.id,
          runtime.backing,
          recorder,
          () => scheduler.now()
        )
      : runtime.backing;
  return {
    id: runtime.id,
    db,
    wipeStorage: async () => {
      await runtime.sql.run('DELETE FROM patches');
      await runtime.sql.run('DELETE FROM snapshots');
    },
  };
}

async function createAllServers(
  serverSpecs: ScenarioServerSpec[]
): Promise<{ servers: ServerRuntime[]; serverById: Map<string, ServerRuntime> }> {
  const servers: ServerRuntime[] = [];
  const serverById = new Map<string, ServerRuntime>();
  for (const spec of serverSpecs) {
    const rt = await createServerRuntime(spec);
    servers.push(rt);
    serverById.set(spec.id, rt);
  }
  return { servers, serverById };
}

async function createAllClients(
  clientSpecs: ScenarioClientSpec[],
  serverById: Map<string, ServerRuntime>,
  scheduler: DeterministicScheduler,
  recorder: SimEventRecorder | null
): Promise<ClientRuntime[]> {
  const clientRuntimes: ClientRuntime[] = [];
  for (const cs of clientSpecs) {
    const server = serverById.get(cs.serverId);
    if (!server) {
      throw new Error(`client ${cs.id}: unknown server ${cs.serverId}`);
    }
    const cr = await createClientRuntime({
      spec: cs,
      server,
      scheduler,
      recorder,
    });
    clientRuntimes.push(cr);
  }
  return clientRuntimes;
}

function buildClientHandles(
  clientRuntimes: ClientRuntime[],
  recorder: SimEventRecorder | null,
  scheduler: DeterministicScheduler
): Map<string, SimClient> {
  const clientHandles = new Map<string, SimClient>();
  for (const runtime of clientRuntimes) {
    const handle = createClientHandle({ runtime, recorder, scheduler });
    clientHandles.set(runtime.id, handle);
  }
  return clientHandles;
}

function buildServerHandles(
  servers: ServerRuntime[],
  recorder: SimEventRecorder | null,
  scheduler: DeterministicScheduler
): Map<string, SimServer> {
  const serverHandles = new Map<string, SimServer>();
  for (const s of servers) {
    serverHandles.set(s.id, createServerHandle(s, recorder, scheduler));
  }
  return serverHandles;
}

function createRecorder(
  scheduler: DeterministicScheduler,
  initialRecordingMeta: Partial<SimRecordingMeta> | undefined
): SimEventRecorder | null {
  if (!isPatchDbAppEnabled()) return null;
  const recorder = new SimEventRecorder(() => scheduler.now());
  if (initialRecordingMeta !== undefined) {
    recorder.setMeta(initialRecordingMeta);
  }
  return recorder;
}

export async function buildScenario(
  serverSpecs: ScenarioServerSpec[],
  clientSpecs: ScenarioClientSpec[],
  initialRecordingMeta?: Partial<SimRecordingMeta>
): Promise<Sim> {
  if (serverSpecs.length === 0) {
    throw new Error('PatchDbScenarioBuilder: add at least one .server()');
  }
  const scheduler = new DeterministicScheduler();
  const recorder = createRecorder(scheduler, initialRecordingMeta);

  const { servers, serverById } = await createAllServers(serverSpecs);
  const clientRuntimes = await createAllClients(
    clientSpecs,
    serverById,
    scheduler,
    recorder
  );

  if (recorder) {
    recorder.setTopology({
      servers: serverSpecs.map((s) => ({ id: s.id })),
      clients: clientSpecs.map((c) => ({ id: c.id, serverId: c.serverId })),
    });
  }

  const clientHandles = buildClientHandles(
    clientRuntimes,
    recorder,
    scheduler
  );
  const serverHandles = buildServerHandles(servers, recorder, scheduler);

  return new Sim({
    scheduler,
    clientHandles,
    serverHandles,
    clientRuntimes,
    serverRuntimes: servers,
    vizRecorder: recorder,
  });
}
