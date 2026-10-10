/**
 * Loopback HTTP listener for the bun-webview product host.
 * Exposes the harness load balancer on a real port so browser clients hit the wire
 * and get round-robined across the live API instances.
 * Partition / crash stay on `createHarnessNet` at the coordinator.
 */

import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import type { Harness } from './create-harness';
import {
  localhostRoomBridge,
  ROOM_UPGRADE_HEADER,
} from './localhost-room-bridge';

const DEFAULT_PORT = 8787;
const ACTOR_HEADER = 'x-harness-actor';
/** Caller id for wire requests that carry no actor header. */
const BROWSER_INGRESS_ID = 'browser';

export type HarnessHttpListener = {
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

function isHarnessNetFault(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.name === 'HarnessPartitionedError' ||
      err.name === 'HarnessCrashedError'
    ) {
      return true;
    }
  }
  return (
    err instanceof TypeError &&
    (err.message.startsWith('harness partition:') ||
      err.message.startsWith('harness crash:'))
  );
}

/** Bind the harness balancer to `127.0.0.1:<port>` (default 8787). */
export async function listenHarnessHttpServer(
  harness: Harness
): Promise<HarnessHttpListener> {
  await harness.spawnServer();
  const port = Number(process.env['HARNESS_HTTP_PORT'] ?? DEFAULT_PORT);
  const bridge = localhostRoomBridge(harness);
  harness.setRoomNamespace(bridge.namespace);
  const server = Bun.serve<{ transport: ClientTransport }>({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const actorId = req.headers.get(ACTOR_HEADER);
      const from =
        actorId != null && actorId !== '' ? actorId : BROWSER_INGRESS_ID;
      try {
        if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
          return await harness.loadBalancer.fetchFrom(from)(req);
        const ticket = harness.server.createId();
        const headers = new Headers(req.headers);
        headers.set(ROOM_UPGRADE_HEADER, ticket);
        const response = await harness.loadBalancer.fetchFrom(from)(
          new Request(req, { headers })
        );
        const transport = bridge.take(ticket);
        if (response.status !== 101 || transport === undefined) return response;
        if (server.upgrade(req, { data: { transport } })) return undefined;
        bridge.close(transport);
        return new Response('Room upgrade failed', { status: 500 });
      } catch (err) {
        if (isHarnessNetFault(err)) return partitionedResponse(err);
        throw err;
      }
    },
    websocket: {
      async open(ws) {
        ws.data.transport.subscribe((frame) => ws.send(JSON.stringify(frame)));
        ws.data.transport.onHandlers({
          onError: () => ws.close(),
          onClose: () => ws.close(),
        });
        try {
          await ws.data.transport.connect();
        } catch {
          ws.close();
        }
      },
      message(ws, message) {
        try {
          ws.data.transport.sendJson(JSON.parse(String(message)));
        } catch {
          ws.close();
        }
      },
      close(ws) {
        bridge.close(ws.data.transport);
      },
    },
  });
  const apiUrl = server.url.origin;
  process.env['VITE_API_URL'] = apiUrl;
  return {
    apiUrl,
    async stop() {
      bridge.dispose();
      harness.setRoomNamespace(undefined);
      await server.stop(true);
    },
  };
}

export { ACTOR_HEADER };
