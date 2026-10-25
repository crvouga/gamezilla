/**
 * Dynamic registry of stateless server (API) instances behind the harness load
 * balancer.
 *
 * Every instance gets its own `ServerEnv` + Hono app + serialized fetch queue,
 * but they all share the backing services a production fleet shares: one
 * Postgres, one Kv, one ObjectStore, one pubsub bus. Per-instance copies of
 * those would make the harness pass where production fails (see the Kv
 * shared-state class of bug).
 */

import { createServer } from '@libs/app-root-server-ts/create-server';
import type { RoomNamespace } from '@libs/app-root-shared-ts/env';
import { serveFetch } from '@libs/app-root-shared-ts/serve-fetch';
import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { composeSubServers } from '@libs/sub-shared-ts/compose-server';
import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared-ts/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { HarnessComposition } from './composition';
import { serializeFetch } from './fetch';
import { nextHarnessNodeId, normalizeHarnessNodeId } from './node-name';

export const HARNESS_PRIMARY_SERVER_ID = 'server-a';

export type Server = Awaited<ReturnType<typeof createServer>>;

export type HarnessServerNode = {
  readonly id: string;
  readonly env: ServerEnv;
  readonly app: Server;
  readonly outboxConsumers: OutboxConsumerRegistry;
  /** The subs' server-only mutation checks the sync mount runs. */
  readonly authorizeMutation: MutationAuthorize;
  /** Serialized so request ALS scopes never interleave within an instance. */
  readonly fetch: ServerHttp;
  readonly drain: () => Promise<void>;
};

export type HarnessServerNodes = {
  setRoomNamespace(namespace: RoomNamespace | undefined): void;
  ensureEnv(id: string): Promise<ServerEnv>;
  spawn(id?: string): Promise<HarnessServerNode>;
  drop(id: string): Promise<void>;
  get(id: string): HarnessServerNode | undefined;
  ids(): readonly string[];
  /** Load-balancer backend view, in spawn order. */
  backends(): readonly { readonly id: string; readonly fetch: ServerHttp }[];
  nextId(): string;
  drainAll(): Promise<void>;
  stopAll(): void;
};

function nextServerId(taken: ReadonlySet<string>): string {
  return nextHarnessNodeId('server', taken);
}

async function openHarnessServer(args: {
  env: ServerEnv;
  composition: HarnessComposition;
  rooms: RoomServicePort;
}) {
  const http = createScopedHttpClient({ fetch: args.env.fetch });
  const env = { ...args.env, fetch: http.fetch };
  const subServers = composeSubServers(
    args.composition.servers({ billing: env.billing, rooms: args.rooms })
  );
  const app = await http.run(() =>
    createServer(env, {
      rooms: args.rooms,
      app: args.composition.app,
      servers: subServers,
    })
  );
  return { http, env, subServers, app };
}

function createServerNodeFetch(args: {
  app: Server;
  roomNamespace: () => RoomNamespace | undefined;
  disposed: () => boolean;
  instanceId: string;
  http: ReturnType<typeof createScopedHttpClient>;
}) {
  const raw = serveFetch((request) => {
    const namespace = args.roomNamespace();
    return args.app.fetch(
      request,
      namespace === undefined ? undefined : { ROOM: namespace }
    );
  });
  return serializeFetch(async (input, init) => {
    if (args.disposed())
      throw new Error(`createHarness: server '${args.instanceId}' disposed`);
    return args.http.run(() => raw(input, init));
  });
}

export function createHarnessServerNodes(args: {
  readonly composition: HarnessComposition;
  readonly rooms: RoomServicePort;
  readonly buildEnv: (id: string) => Promise<ServerEnv>;
  /** Guard so a disposed harness cannot boot another instance. */
  readonly disposed: () => boolean;
}): HarnessServerNodes {
  const envs = new Map<string, ServerEnv>();
  const nodes = new Map<string, HarnessServerNode>();
  const order: string[] = [];
  let roomNamespace: RoomNamespace | undefined;

  async function ensureEnv(id: string): Promise<ServerEnv> {
    const cached = envs.get(id);
    if (cached !== undefined) return cached;
    const env = await args.buildEnv(id);
    envs.set(id, env);
    return env;
  }

  return {
    setRoomNamespace: (namespace) => {
      roomNamespace = namespace;
    },
    ensureEnv,
    async spawn(id) {
      const instanceId =
        id === undefined || id.trim() === ''
          ? nextServerId(new Set(nodes.keys()))
          : normalizeHarnessNodeId(id, 'server');
      const existing = nodes.get(instanceId);
      if (existing !== undefined) return existing;
      if (args.disposed()) {
        throw new Error('createHarness: server disposed');
      }
      const { http, env, subServers, app } = await openHarnessServer({
        env: await ensureEnv(instanceId),
        composition: args.composition,
        rooms: args.rooms,
      });
      const serialized = createServerNodeFetch({
        app,
        roomNamespace: () => roomNamespace,
        disposed: args.disposed,
        instanceId,
        http,
      });
      const node: HarnessServerNode = {
        id: instanceId,
        env,
        app,
        outboxConsumers: subServers.outboxConsumers,
        authorizeMutation: subServers.authorizeMutation,
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
        .filter((node): node is HarnessServerNode => node !== undefined)
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
