import type { Unsubscribe } from '@pkgs/pub-sub/interface';
import { SYNC_ERROR_TOPIC, type SyncErrorEvent } from '../impl-sync';
import type { Entity, PatchDbQuery } from '../interface';
import {
  assertNodesConsistent,
  type NodeSnapshot,
} from './assert-nodes-consistent';
import type { DeterministicScheduler } from './deterministic-scheduler';
import { type SimEventRecorder, type SimRecordingMeta } from './event-recorder';
import { saveRecording } from './recording-store';
import type {
  ClientRuntime,
  ServerRuntime,
  SimClient,
  SimServer,
} from './sim-types';

export type SimOptions = {
  scheduler: DeterministicScheduler;
  clientHandles: Map<string, SimClient>;
  serverHandles: Map<string, SimServer>;
  clientRuntimes: ClientRuntime[];
  serverRuntimes: ServerRuntime[];
  vizRecorder: SimEventRecorder | null;
};

export class Sim {
  /** Escape hatch for latency / deterministic time (advanced tests). */
  readonly scheduler: DeterministicScheduler;
  private readonly clientHandles: Map<string, SimClient>;
  private readonly serverHandles: Map<string, SimServer>;
  private readonly clientRuntimes: ClientRuntime[];
  private readonly serverRuntimes: ServerRuntime[];
  private readonly vizRecorder: SimEventRecorder | null;
  private vizOptedIn = false;

  constructor(options: SimOptions) {
    this.scheduler = options.scheduler;
    this.clientHandles = options.clientHandles;
    this.serverHandles = options.serverHandles;
    this.clientRuntimes = options.clientRuntimes;
    this.serverRuntimes = options.serverRuntimes;
    this.vizRecorder = options.vizRecorder;
  }

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

  /** Merge viz metadata. Set `enableViz` to persist the recording (requires `PATCHDB_APP=1`). */
  setMeta(options: Partial<SimRecordingMeta> & { enableViz?: boolean }): void {
    const { enableViz, ...meta } = options;
    if (enableViz) this.vizOptedIn = true;
    this.vizRecorder?.setMeta(meta);
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

  /**
   * Read `query` on every client and every server, then assert they all
   * agree on the same set of entity IDs and the same attribute values.
   */
  async assertConsistent(query: PatchDbQuery): Promise<void> {
    const nodes = await this.readAllNodes(query);
    assertNodesConsistent(nodes);
  }

  /**
   * Assert that specific entities (by ID) have identical attributes across
   * every client and every server.
   */
  async assertEntitiesConsistent(
    entityType: string,
    entityIds: string[]
  ): Promise<void> {
    const query: PatchDbQuery = {
      entityType,
      entityId: entityIds,
    };
    const nodes = await this.readAllNodes(query);
    assertNodesConsistent(nodes);
  }

  private async readAllNodes(query: PatchDbQuery): Promise<NodeSnapshot[]> {
    const nodes: NodeSnapshot[] = [];
    for (const [id, client] of this.clientHandles) {
      const results = await client.read([query]);
      const ents: Entity[] = results[0]?.entities ?? [];
      nodes.push({ nodeId: `client:${id}`, entities: ents });
    }
    for (const [id, server] of this.serverHandles) {
      const results = await server.db.read([query]);
      const ents: Entity[] = results[0]?.entities ?? [];
      nodes.push({ nodeId: `server:${id}`, entities: ents });
    }
    return nodes;
  }

  async destroy(): Promise<void> {
    for (const c of this.clientRuntimes) {
      for (const u of c.vizUnsubs) {
        u();
      }
      c.syncDb.destroy();
      await c.sqlClient.disconnect();
    }
    for (const s of this.serverRuntimes) {
      await s.sql.disconnect();
    }
    this.clientHandles.clear();
    this.serverHandles.clear();

    if (this.vizRecorder !== null && this.vizOptedIn) {
      saveRecording(this.vizRecorder.finalize());
    }
  }
}
