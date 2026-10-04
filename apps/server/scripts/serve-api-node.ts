#!/usr/bin/env bun

// @io-wall-ok — process entry for one API instance of the localhost stack.

/**
 * One API instance, on Bun, on its own port.
 *
 * It runs the production Worker handler unchanged: same boot, same secret
 * resolution, same Hono app. Only two things are supplied locally — the
 * listener (Bun instead of workerd) and the `ROOM` binding, which a Durable
 * Object namespace provides in production and {@link createBunRoomHost}
 * provides here.
 *
 * Everything it needs arrives as environment variables, so the orchestrator
 * can start as many of these as it likes on as many ports as it likes.
 */

import workerHandler from '@apps/server/server';
import type { ApiWorkerEnv, RoomNamespace } from '@libs/app-shared/env';
import type { ExecutionContext } from '@libs/app-shared/worker-handler';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { composeRoomModules } from '@libs/spaces-shared/load-game-plugins';
import { createSpaceRoomAuthorizer } from '@libs/spaces-shared/space-room-authorize';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import type { BunRoomSocketData } from '@pkgs/room-adapter-bun-server/bun-room-host';
import { createBunRoomHost } from '@pkgs/room-adapter-bun-server/bun-room-host';
import {
  decodeRoomGrants,
  ROOM_GRANTS_HEADER,
} from '@pkgs/room-server/grants-header';

const PORT = Number(process.env['API_NODE_PORT'] ?? 0);
const NODE_ID = process.env['API_NODE_ID'] ?? 'api-a';
/** Correlates the DO-shaped stub call back to the request Bun must upgrade. */
const UPGRADE_HEADER = 'x-bun-room-upgrade';

const rooms = createBunRoomHost({
  modules: composeRoomModules(
    GAME_DEFINITIONS,
    () => wallClock.now(),
    Math.random
  ),
  authorize: createSpaceRoomAuthorizer(GAME_DEFINITIONS),
  clock: wallClock,
  timers: wallTimers,
  createId: () => crypto.randomUUID(),
});

const pendingUpgrades = new Map<string, BunRoomSocketData>();

/** The room topic each opaque namespace id stands for. */
const roomTopics = new WeakMap<object, string>();

function answerRoomUpgrade(topic: string, request: Request): Response {
  const url = new URL(request.url);
  const ticket = request.headers.get(UPGRADE_HEADER) ?? '';
  const data = rooms.accept({
    topic,
    moduleName: url.searchParams.get('module') ?? '',
    actorId: request.headers.get('x-actor-id') ?? '',
    clientId: request.headers.get('x-actor-client-id') ?? crypto.randomUUID(),
    // Set by the API room gateway, which replaces any client-supplied value.
    grants: decodeRoomGrants(request.headers.get(ROOM_GRANTS_HEADER)),
  });
  if (data === null || ticket.length === 0) {
    return new Response('unknown room module', { status: 400 });
  }
  pendingUpgrades.set(ticket, data);
  return new Response(null, { status: 101 });
}

/**
 * The `ROOM` binding, shaped like a Durable Object namespace. The stub cannot
 * upgrade the socket itself — only the Bun server can — so it records what
 * the upgrade should be and answers 101; the listener finishes the job.
 */
const roomNamespace: RoomNamespace = {
  idFromName: (name) => {
    const id = { name };
    roomTopics.set(id, name);
    return id;
  },
  get: (id) => ({
    fetch: (request) => {
      const topic = roomTopics.get(id) ?? '';
      if (new URL(request.url).pathname === '/room-service') {
        const target = new URL('/__room-service', process.env['API_URL']);
        target.search = new URL(request.url).search;
        const forwarded = new Request(target, request);
        forwarded.headers.set(
          'x-room-service-token',
          process.env['LOCAL_ROOM_SERVICE_TOKEN'] ?? ''
        );
        return fetch(forwarded);
      }
      return Promise.resolve(answerRoomUpgrade(topic, request));
    },
  }),
};

function workerEnv(): ApiWorkerEnv {
  return { ...process.env, ROOM: roomNamespace };
}

const executionContext = {
  waitUntil: (promise: Promise<unknown>) => {
    void promise.catch(() => undefined);
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

const server = Bun.serve<BunRoomSocketData>({
  port: PORT,
  hostname: '127.0.0.1',
  idleTimeout: 60,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__room-service') {
      const token = process.env['LOCAL_ROOM_SERVICE_TOKEN'];
      if (!token || request.headers.get('x-room-service-token') !== token)
        return new Response(null, { status: 403 });
      return rooms.service(
        url.searchParams.get('topic') ?? '',
        url.searchParams.get('module') ?? '',
        request
      );
    }
    const wantsRoom =
      url.pathname === '/api/room' &&
      (request.headers.get('upgrade') ?? '').toLowerCase() === 'websocket';
    if (!wantsRoom) {
      return await workerHandler.fetch(request, workerEnv(), executionContext);
    }
    const ticket = crypto.randomUUID();
    const headers = new Headers(request.headers);
    headers.set(UPGRADE_HEADER, ticket);
    const routed = await workerHandler.fetch(
      new Request(request, { headers }),
      workerEnv(),
      executionContext
    );
    const data = pendingUpgrades.get(ticket);
    pendingUpgrades.delete(ticket);
    if (routed.status !== 101 || data === undefined) return routed;
    if (server.upgrade(request, { data })) return undefined as never;
    return new Response('websocket upgrade failed', { status: 500 });
  },
  websocket: {
    async open(ws) {
      await rooms.open(
        ws.data,
        (raw) => {
          ws.send(raw);
        },
        () => ws.close()
      );
    },
    async message(ws, message) {
      await rooms.message(ws.data, String(message));
    },
    close(ws) {
      rooms.close(ws.data);
    },
  },
});

process.stdout.write(
  `${JSON.stringify({ node: NODE_ID, origin: server.url.origin })}\n`
);

const stop = (): void => {
  rooms.dispose();
  void server.stop(true).then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
