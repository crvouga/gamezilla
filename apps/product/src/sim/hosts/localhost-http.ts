/**
 * Loopback HTTP listener for the bun-webview product host.
 * Exposes the sim load balancer on a real port so browser clients hit the wire
 * and get round-robined across the live API instances.
 * Partition / crash stay on `createSimNet` at the coordinator.
 */

import type { Sim } from '@apps/product/sim/fabric/create-sim';
import {
  readSimRoomAccept,
  type SimRoomAccept,
} from '@apps/product/sim/fabric/sim-room-namespace';
import type { RoomSocket } from '@apps/room-server/app/create-room-server';
import type { ServerWebSocket } from 'bun';

import {
  completeDevAuthSession,
  isDevAuthSessionRequest,
} from './dev-auth-session';

const DEFAULT_PORT = 8787;
const ACTOR_HEADER = 'x-sim-actor';
/** Caller id for wire requests that carry no actor header. */
const BROWSER_INGRESS_ID = 'browser';

export type SimHttpListener = {
  readonly apiUrl: string;
  stop(): Promise<void>;
};

function partitionedResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return new Response(message, {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function isSimNetFault(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'SimPartitionedError' || err.name === 'SimCrashedError') {
      return true;
    }
  }
  return (
    err instanceof TypeError &&
    (err.message.startsWith('sim partition:') ||
      err.message.startsWith('sim crash:'))
  );
}

type RoomSocketData = {
  readonly accept: SimRoomAccept;
  socket: Promise<RoomSocket> | null;
};

function isWebSocketUpgrade(req: Request): boolean {
  return req.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

/**
 * Room frames between a browser socket and the in-process room server. The
 * API route already resolved the actor; see `createSimRoomNamespace`.
 */
function roomSocketHandlers(sim: Sim) {
  return {
    open(ws: ServerWebSocket<RoomSocketData>) {
      ws.data.socket = sim.roomNode.connectSocket({
        ...ws.data.accept,
        send: (payload) => {
          ws.send(JSON.stringify(payload));
        },
      });
    },
    async message(ws: ServerWebSocket<RoomSocketData>, frame: string | Buffer) {
      const text = typeof frame === 'string' ? frame : frame.toString('utf8');
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        ws.close(1007, 'invalid JSON frame');
        return;
      }
      await (await ws.data.socket)?.message(raw);
    },
    async close(ws: ServerWebSocket<RoomSocketData>) {
      (await ws.data.socket)?.close();
    },
  };
}

/** Bind the sim balancer to `localhost:<port>` (default 8787). */
export async function listenSimHttpServer(sim: Sim): Promise<SimHttpListener> {
  await sim.spawnServer();
  const port = Number(process.env['SIM_HTTP_PORT'] ?? DEFAULT_PORT);
  const server = Bun.serve<RoomSocketData>({
    port,
    hostname: 'localhost',
    async fetch(req, bun) {
      const actorId = req.headers.get(ACTOR_HEADER);
      const from =
        actorId != null && actorId !== '' ? actorId : BROWSER_INGRESS_ID;
      try {
        if (isDevAuthSessionRequest(req)) {
          return await completeDevAuthSession(
            req,
            (input, init) =>
              sim.loadBalancer.fetchFrom(from)(new Request(input, init)),
            from
          );
        }
        const response = await sim.loadBalancer.fetchFrom(from)(req);
        const accept = isWebSocketUpgrade(req)
          ? readSimRoomAccept(response)
          : null;
        if (
          accept !== null &&
          bun.upgrade(req, { data: { accept, socket: null } })
        ) {
          return undefined;
        }
        return response;
      } catch (err) {
        if (isSimNetFault(err)) return partitionedResponse(err);
        throw err;
      }
    },
    websocket: roomSocketHandlers(sim),
  });
  const apiUrl = server.url.origin;
  process.env['VITE_API_URL'] = apiUrl;
  return {
    apiUrl,
    stop: () => server.stop(true),
  };
}

export { ACTOR_HEADER };
