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

import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeRoomModules } from '@libs/spaces/public/load-game-plugins';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  type BunRoomSocketData,
  createBunRoomHost,
} from '@pkgs/room-adapter-bun';

import type { ApiWorkerEnv } from '../src/config/env';
import workerHandler from '../src/server';

const PORT = Number(process.env['API_NODE_PORT'] ?? 0);
const NODE_ID = process.env['API_NODE_ID'] ?? 'api-a';
/** Correlates the DO-shaped stub call back to the request Bun must upgrade. */
const UPGRADE_HEADER = 'x-bun-room-upgrade';

const rooms = createBunRoomHost({
  modules: composeRoomModules(GAME_DEFINITIONS, () => wallClock.now()),
  clock: wallClock,
  timers: wallTimers,
  createId: () => crypto.randomUUID(),
});

const pendingUpgrades = new Map<string, BunRoomSocketData>();

/**
 * The `ROOM` binding, shaped like a Durable Object namespace. The stub cannot
 * upgrade the socket itself — only the Bun server can — so it records what
 * the upgrade should be and answers 101; the listener finishes the job.
 */
const roomNamespace = {
  idFromName: (name: string) => ({ name }),
  get: (id: { name: string }) => ({
    fetch(request: Request): Response {
      const url = new URL(request.url);
      const ticket = request.headers.get(UPGRADE_HEADER) ?? '';
      const data = rooms.accept({
        topic: id.name,
        moduleName: url.searchParams.get('module') ?? '',
        actorId: request.headers.get('x-actor-id') ?? '',
        clientId:
          request.headers.get('x-actor-client-id') ?? crypto.randomUUID(),
      });
      if (data === null || ticket.length === 0) {
        return new Response('unknown room module', { status: 400 });
      }
      pendingUpgrades.set(ticket, data);
      return new Response(null, { status: 101 });
    },
  }),
};

function workerEnv(): ApiWorkerEnv {
  return { ...process.env, ROOM: roomNamespace } as ApiWorkerEnv;
}

const executionContext = {
  waitUntil: (promise: Promise<unknown>) => {
    void promise.catch(() => undefined);
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

const server = Bun.serve<BunRoomSocketData, Record<string, never>>({
  port: PORT,
  hostname: '127.0.0.1',
  idleTimeout: 60,
  async fetch(request) {
    const url = new URL(request.url);
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
      await rooms.open(ws.data, (raw) => {
        ws.send(raw);
      });
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
