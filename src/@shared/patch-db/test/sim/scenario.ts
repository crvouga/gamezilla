import { InMemoryPubSub } from '../../../pub-sub/impl-in-memory';
import type { Unsubscribe } from '../../../pub-sub/interface';
import { SqlClientImplBunSqlite } from '../../../sql-client/impl-bun-sqlite';
import type { SqlClient } from '../../../sql-client/interface';
import { PatchDbImplClientTransport } from '../../impl-client-transport';
import { PatchDbImplSqlite } from '../../impl-sqlite/impl-sqlite';
import {
  SYNC_ERROR_TOPIC,
  type SyncErrorEvent,
  SyncPatchesDb,
} from '../../impl-sync';
import type {
  Patch,
  PatchInput,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
} from '../../interface';
import { PatchDbImplSyncHost } from '../../transport/impl-sync-host';
import { DeterministicScheduler } from './deterministic-scheduler';
import { NetworkLink } from './network-link';
import { NotifyingPatchesDb } from './notifying-patches-db';
import {
  type SimServerPort,
  simServerPortFromPubSub,
  simServerPortFromSyncHost,
} from './server-port';
import { SimulatedPatchDbClientTransport } from './simulated-client-transport';

const SYNC_SUBSCRIPTION_MICROTASK_ROUNDS = 32;

async function flushSyncSubscriptionMicrotasks(
  rounds: number = SYNC_SUBSCRIPTION_MICROTASK_ROUNDS
): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

export type ScenarioServerSpec = {
  id: string;
  /** When true, use {@link PatchDbImplSyncHost} merge-on-read semantics. */
  useSyncHost: boolean;
};

export type ScenarioClientSpec = {
  id: string;
  serverId: string;
};

type ServerRuntime = {
  id: string;
  sql: SqlClient;
  backing: PatchDbImplSqlite;
  pubSub: InMemoryPubSub;
  port: SimServerPort;
};

type ClientRuntime = {
  id: string;
  serverId: string;
  sqlClient: SqlClient;
  localDb: PatchDbImplSqlite;
  transport: SimulatedPatchDbClientTransport;
  remoteDb: PatchesDb;
  syncDb: SyncPatchesDb;
  pubSub: InMemoryPubSub;
  link: NetworkLink;
};

function createSimLink(link: NetworkLink): SimLink {
  return {
    partition: () => link.setPartitioned(true),
    heal: () => link.setPartitioned(false),
    failNextRead: (err?: Error) =>
      link.failNextReadWith(err ?? new Error('simulated read failure')),
    failNextWrite: (err?: Error) =>
      link.failNextWriteWith(err ?? new Error('simulated write failure')),
    setLatency: (ms: number) => link.setReadWriteLatencyMs(ms),
    setInvalidationLatency: (ms: number) => link.setInvalidationLatencyMs(ms),
    isPartitioned: () => link.isPartitioned(),
  };
}

export type SimLink = {
  partition(): void;
  heal(): void;
  failNextRead(err?: Error): void;
  failNextWrite(err?: Error): void;
  setLatency(ms: number): void;
  setInvalidationLatency(ms: number): void;
  isPartitioned(): boolean;
};

export type SimClient = {
  id: string;
  /** Write patches to local (unsynced). */
  write(patches: PatchInput[]): Promise<Patch[]>;
  /** Read from local db. */
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  /** Run one push cycle + flush microtasks. */
  push(): Promise<void>;
  /** Run one poll cycle + flush microtasks. */
  poll(): Promise<void>;
  subscribe: SyncPatchesDb['subscribe'];
  link: SimLink;
  /** Escape hatch: raw SyncPatchesDb (for edge-case tests). */
  syncDb: SyncPatchesDb;
};

export type SimServer = {
  id: string;
  /** The authority PatchesDb (write here to simulate other clients). */
  db: PatchesDb;
};

class PatchDbScenarioBuilder {
  private readonly servers: ScenarioServerSpec[] = [];
  private readonly clients: ScenarioClientSpec[] = [];

  server(id: string, options?: { useSyncHost?: boolean }): this {
    this.servers.push({
      id,
      useSyncHost: options?.useSyncHost ?? false,
    });
    return this;
  }

  client(id: string, options: { server: string }): this {
    this.clients.push({ id, serverId: options.server });
    return this;
  }

  async build(): Promise<Sim> {
    return buildScenario(this.servers, this.clients);
  }
}

export function patchDbScenario(): PatchDbScenarioBuilder {
  return new PatchDbScenarioBuilder();
}

export class Sim {
  constructor(
    /** Escape hatch for latency / deterministic time (advanced tests). */
    readonly scheduler: DeterministicScheduler,
    private readonly clientHandles: Map<string, SimClient>,
    private readonly serverHandles: Map<string, SimServer>,
    private readonly clientRuntimes: ClientRuntime[],
    private readonly serverRuntimes: ServerRuntime[]
  ) {}

  client(id: string): SimClient {
    const c = this.clientHandles.get(id);
    if (!c) throw new Error(`Unknown client id: ${id}`);
    return c;
  }

  server(id: string): SimServer {
    const s = this.serverHandles.get(id);
    if (!s) throw new Error(`Unknown server id: ${id}`);
    return s;
  }

  subscribeSyncErrors(listener: (event: SyncErrorEvent) => void): Unsubscribe {
    const unsubs = this.clientRuntimes.map((c) =>
      c.pubSub.subscribe(SYNC_ERROR_TOPIC, (msg: unknown) => {
        listener(msg as SyncErrorEvent);
      })
    );
    return () => {
      for (const u of unsubs) u();
    };
  }

  async destroy(): Promise<void> {
    for (const c of this.clientRuntimes) {
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    for (const s of this.serverRuntimes) {
      await s.sql.disconnect();
    }
    this.clientHandles.clear();
    this.serverHandles.clear();
  }
}

async function buildScenario(
  serverSpecs: ScenarioServerSpec[],
  clientSpecs: ScenarioClientSpec[]
): Promise<Sim> {
  if (serverSpecs.length === 0) {
    throw new Error('patchDbScenario: add at least one .server()');
  }
  const scheduler = new DeterministicScheduler();

  const servers: ServerRuntime[] = [];
  const serverById = new Map<string, ServerRuntime>();

  for (const spec of serverSpecs) {
    const sql = SqlClientImplBunSqlite.open(':memory:');
    await sql.connect();
    const backing = new PatchDbImplSqlite(sql);
    await backing.migrate();
    const pubSub = new InMemoryPubSub();

    let port: SimServerPort;
    if (spec.useSyncHost) {
      const host = new PatchDbImplSyncHost(backing, pubSub);
      port = simServerPortFromSyncHost(host);
    } else {
      const notifying = new NotifyingPatchesDb(backing, pubSub);
      port = simServerPortFromPubSub(
        (q) => notifying.read(q),
        (p) => notifying.write(p),
        pubSub
      );
    }

    const rt: ServerRuntime = {
      id: spec.id,
      sql,
      backing,
      pubSub,
      port,
    };
    servers.push(rt);
    serverById.set(spec.id, rt);
  }

  const clientRuntimes: ClientRuntime[] = [];

  for (const cs of clientSpecs) {
    const server = serverById.get(cs.serverId);
    if (!server) {
      throw new Error(`client ${cs.id}: unknown server ${cs.serverId}`);
    }

    const sql = SqlClientImplBunSqlite.open(':memory:');
    await sql.connect();
    const local = new PatchDbImplSqlite(sql);
    await local.migrate();

    const link = new NetworkLink(scheduler);
    const transport = new SimulatedPatchDbClientTransport(server.port, link);
    const remotePatchesDb = new PatchDbImplClientTransport(transport);
    const pubSub = new InMemoryPubSub();

    const syncDb = new SyncPatchesDb(local, remotePatchesDb, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      remoteInvalidationSource: transport,
      pushIntervalMs: 10,
    });

    const cr: ClientRuntime = {
      id: cs.id,
      serverId: cs.serverId,
      sqlClient: sql,
      localDb: local,
      transport,
      remoteDb: remotePatchesDb,
      syncDb,
      pubSub,
      link,
    };
    clientRuntimes.push(cr);
  }

  const clientHandles = new Map<string, SimClient>();
  for (const c of clientRuntimes) {
    const simLink = createSimLink(c.link);
    const handle: SimClient = {
      id: c.id,
      write: (patches) => c.syncDb.write(patches),
      read: (queries) => c.syncDb.read(queries),
      push: async () => {
        await c.syncDb.runPushNow();
        await flushSyncSubscriptionMicrotasks();
      },
      poll: async () => {
        await c.syncDb.runPollNow();
        await flushSyncSubscriptionMicrotasks();
      },
      subscribe: c.syncDb.subscribe,
      link: simLink,
      syncDb: c.syncDb,
    };
    clientHandles.set(c.id, handle);
  }

  const serverHandles = new Map<string, SimServer>();
  for (const s of servers) {
    serverHandles.set(s.id, { id: s.id, db: s.backing });
  }

  return new Sim(
    scheduler,
    clientHandles,
    serverHandles,
    clientRuntimes,
    servers
  );
}
