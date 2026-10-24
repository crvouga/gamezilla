import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import {
  type localhostRoomBridge,
  ROOM_UPGRADE_HEADER,
} from './localhost-room-bridge';

type Bridge = ReturnType<typeof localhostRoomBridge>;
export type HarnessRoomSocket = { transport: ClientTransport };

/** Both native realms and browser hosts use the existing room gateway and wire bridge. */
export async function forwardHarnessRoomRequest(
  request: Request,
  ports: {
    bridge: Bridge;
    createId: () => string;
    forward: (request: Request) => Promise<Response>;
    upgrade: (transport: ClientTransport) => boolean;
  }
): Promise<Response | undefined> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return ports.forward(request);
  const ticket = ports.createId();
  const headers = new Headers(request.headers);
  headers.set(ROOM_UPGRADE_HEADER, ticket);
  const response = await ports.forward(new Request(request, { headers }));
  const transport = ports.bridge.take(ticket);
  if (response.status !== 101 || transport === undefined) return response;
  if (ports.upgrade(transport)) return undefined;
  ports.bridge.close(transport);
  return new Response('Room upgrade failed', { status: 500 });
}

export function harnessRoomSocketHandlers(
  bridge: Pick<Bridge, 'close'>
): Bun.WebSocketHandler<HarnessRoomSocket> {
  return {
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
  };
}
