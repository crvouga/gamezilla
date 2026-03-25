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
import type { PatchesDb } from '../../interface';
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

export type PatchDbSimClient = {
  id: string;
  syncDb: SyncPatchesDb;
  localDb: PatchesDb;
  remoteDb: PatchesDb;
  transport: SimulatedPatchDbClientTransport;
  runPush: () => Promise<void>;
  runPoll: () => Promise<void>;
  link: NetworkLink;
};

export type PatchDbSimServer = {
  id: string;
  authority: PatchesDb;
  pubSub: InMemoryPubSub;
};

export class PatchDbScenarioBuilder {
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

  async build(): Promise<BuiltPatchDbScenario> {
    return buildScenario(this.servers, this.clients);
  }
}

export function patchDbScenario(): PatchDbScenarioBuilder {
  return new PatchDbScenarioBuilder();
}

export class BuiltPatchDbScenario {
  private readonly serverMap = new Map<string, ServerRuntime>();
  private readonly clientMap = new Map<string, ClientRuntime>();
  private readonly linkIndex = new Map<string, NetworkLink>();

  constructor(
    readonly scheduler: DeterministicScheduler,
    servers: ServerRuntime[],
    clientRuntimes: ClientRuntime[],
    links: { key: string; link: NetworkLink }[]
  ) {
    for (const s of servers) this.serverMap.set(s.id, s);
    for (const c of clientRuntimes) this.clientMap.set(c.id, c);
    for (const { key, link } of links) this.linkIndex.set(key, link);
  }

  private linkKey(clientId: string, serverId: string): string {
    return `${clientId}→${serverId}`;
  }

  getServer(id: string): PatchDbSimServer {
    const s = this.serverMap.get(id);
    if (!s) throw new Error(`Unknown server id: ${id}`);
    return { id: s.id, authority: s.backing, pubSub: s.pubSub };
  }

  getClient(id: string): PatchDbSimClient {
    const c = this.clientMap.get(id);
    if (!c) throw new Error(`Unknown client id: ${id}`);
    const link = this.linkIndex.get(this.linkKey(c.id, c.serverId));
    if (!link) {
      throw new Error(`Missing link for client ${c.id} server ${c.serverId}`);
    }
    return {
      id: c.id,
      syncDb: c.syncDb,
      localDb: c.localDb,
      remoteDb: c.remoteDb,
      transport: c.transport,
      runPush: () => c.syncDb.runPushNow(),
      runPoll: () => c.syncDb.runPollNow(),
      link,
    };
  }

  link(clientId: string, serverId: string): NetworkLink {
    const k = this.linkKey(clientId, serverId);
    const l = this.linkIndex.get(k);
    if (!l) throw new Error(`No link for ${k}`);
    return l;
  }

  async runUntilIdle(): Promise<void> {
    await this.scheduler.drain();
  }

  async tick(): Promise<boolean> {
    return this.scheduler.tick();
  }

  subscribeSyncErrors(listener: (event: SyncErrorEvent) => void): Unsubscribe {
    const unsubs = [...this.clientMap.values()].map((c) =>
      c.pubSub.subscribe(SYNC_ERROR_TOPIC, (msg: unknown) => {
        listener(msg as SyncErrorEvent);
      })
    );
    return () => {
      for (const u of unsubs) u();
    };
  }

  async destroy(): Promise<void> {
    for (const c of this.clientMap.values()) {
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    for (const s of this.serverMap.values()) {
      await s.sql.disconnect();
    }
    this.clientMap.clear();
    this.serverMap.clear();
    this.linkIndex.clear();
  }
}

/**
 * Scripted steps for scenarios (partition, latency, flush, …). Execute with {@link PatchDbSimDSL.runWith}.
 */
export class PatchDbSimDSL {
  private readonly steps: ((
    sim: BuiltPatchDbScenario
  ) => void | Promise<void>)[] = [];

  /** Block read/write + invalidation delivery on the link (like total partition). */
  partition(clientId: string, serverId: string): this {
    this.steps.push(async (sim) => {
      sim.link(clientId, serverId).setPartitioned(true);
    });
    return this;
  }

  heal(clientId: string, serverId: string): this {
    this.steps.push(async (sim) => {
      sim.link(clientId, serverId).setPartitioned(false);
    });
    return this;
  }

  setReadWriteLatencyMs(clientId: string, serverId: string, ms: number): this {
    this.steps.push(async (sim) => {
      sim.link(clientId, serverId).setReadWriteLatencyMs(ms);
    });
    return this;
  }

  setInvalidationLatencyMs(
    clientId: string,
    serverId: string,
    ms: number
  ): this {
    this.steps.push(async (sim) => {
      sim.link(clientId, serverId).setInvalidationLatencyMs(ms);
    });
    return this;
  }

  flush(): this {
    this.steps.push((sim) => sim.runUntilIdle());
    return this;
  }

  runSteps(n: number): this {
    this.steps.push(async (sim) => {
      for (let i = 0; i < n; i++) {
        await sim.tick();
      }
    });
    return this;
  }

  async runWith(sim: BuiltPatchDbScenario): Promise<void> {
    for (const step of this.steps) await step(sim);
  }
}

async function buildScenario(
  serverSpecs: ScenarioServerSpec[],
  clientSpecs: ScenarioClientSpec[]
): Promise<BuiltPatchDbScenario> {
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
  const links: { key: string; link: NetworkLink }[] = [];

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
    links.push({ key: `${cs.id}→${cs.serverId}`, link });
  }

  return new BuiltPatchDbScenario(scheduler, servers, clientRuntimes, links);
}
