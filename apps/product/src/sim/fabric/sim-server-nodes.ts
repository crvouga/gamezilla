/**
 * Dynamic registry of stateless server (API) instances behind the sim load
 * balancer.
 *
 * Every instance gets its own `ServerEnv` + Hono app + serialized fetch queue,
 * but they all share the backing services a production fleet shares: one
 * Postgres, one Kv, one ObjectStore, one pubsub bus. Per-instance copies of
 * those would make the sim pass where production fails (see the Kv
 * shared-state class of bug).
 */

import { createServer, type ServerEnv, serveFetch } from '@apps/server';
import type { ServerHttp } from '@libs/client-app/shell/client-env';
import { serializeFetch } from './sim-fetch';
import { nextSimNodeId, normalizeSimNodeId } from './sim-node-name';

export const SIM_PRIMARY_SERVER_ID = 'server-a';

export type Server = Awaited<ReturnType<typeof createServer>>;

export type SimServerNode = {
  readonly id: string;
  readonly env: ServerEnv;
  readonly app: Server;
  /** Serialized so request ALS scopes never interleave within an instance. */
  readonly fetch: ServerHttp;
  readonly drain: () => Promise<void>;
};

export type SimServerNodes = {
  ensureEnv(id: string): Promise<ServerEnv>;
  spawn(id?: string): Promise<SimServerNode>;
  drop(id: string): Promise<void>;
  get(id: string): SimServerNode | undefined;
  ids(): readonly string[];
  /** Load-balancer backend view, in spawn order. */
  backends(): readonly { readonly id: string; readonly fetch: ServerHttp }[];
  nextId(): string;
  drainAll(): Promise<void>;
  stopAll(): void;
};

function nextServerId(taken: ReadonlySet<string>): string {
  return nextSimNodeId('server', taken);
}

export function createSimServerNodes(args: {
  readonly buildEnv: (id: string) => Promise<ServerEnv>;
  /** Guard so a disposed sim cannot boot another instance. */
  readonly disposed: () => boolean;
}): SimServerNodes {
  const envs = new Map<string, ServerEnv>();
  const nodes = new Map<string, SimServerNode>();
  const order: string[] = [];

  async function ensureEnv(id: string): Promise<ServerEnv> {
    const cached = envs.get(id);
    if (cached !== undefined) return cached;
    const env = await args.buildEnv(id);
    envs.set(id, env);
    return env;
  }

  return {
    ensureEnv,
    async spawn(id) {
      const instanceId =
        id === undefined || id.trim() === ''
          ? nextServerId(new Set(nodes.keys()))
          : normalizeSimNodeId(id, 'server');
      const existing = nodes.get(instanceId);
      if (existing !== undefined) return existing;
      if (args.disposed()) {
        throw new Error('createSim: server disposed');
      }
      const env = await ensureEnv(instanceId);
      const app = await createServer(env);
      const raw = serveFetch((request) => app.fetch(request));
      const serialized = serializeFetch(async (input, init) => {
        if (args.disposed()) {
          throw new Error(`createSim: server '${instanceId}' disposed`);
        }
        return raw(input, init);
      });
      const node: SimServerNode = {
        id: instanceId,
        env,
        app,
        fetch: serialized.fetch,
        drain: serialized.drain,
      };
      nodes.set(instanceId, node);
      order.push(instanceId);
      return node;
    },
    async drop(id) {
      const node = nodes.get(id);
      if (node === undefined) return;
      nodes.delete(id);
      const at = order.indexOf(id);
      if (at >= 0) order.splice(at, 1);
      // Env stays cached: a respawned instance must keep its seeded id stream.
      await node.drain();
    },
    get: (id) => nodes.get(id),
    ids: () => [...order],
    backends: () =>
      order
        .map((id) => nodes.get(id))
        .filter((node): node is SimServerNode => node !== undefined)
        .map((node) => ({ id: node.id, fetch: node.fetch })),
    nextId: () => nextServerId(new Set(nodes.keys())),
    async drainAll() {
      for (const node of [...nodes.values()]) await node.drain();
    },
    stopAll() {
      nodes.clear();
      order.length = 0;
      envs.clear();
    },
  };
}
