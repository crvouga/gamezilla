import type { RoomNamespace } from '@libs/app-root-shared-ts/env';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import type { Harness } from './create-harness';

export const ROOM_UPGRADE_HEADER = 'x-harness-room-upgrade';

/** A wire adapter for the existing harness authority, behind the real gateway. */
export function localhostRoomBridge(harness: Harness) {
  const pending = new Map<string, ClientTransport>();
  const live = new Set<ClientTransport>();
  const topics = new WeakMap<object, string>();
  const namespace: RoomNamespace = {
    idFromName(topic) {
      const id = {};
      topics.set(id, topic);
      return id;
    },
    get(id) {
      return {
        fetch: (request) => {
          const topic = topics.get(id);
          const ticket = request.headers.get(ROOM_UPGRADE_HEADER);
          if (topic === undefined || ticket === null)
            return Promise.resolve(
              new Response('Room upgrade required', { status: 426 })
            );
          const url = new URL(request.url);
          const transport = harness.roomNode.createTransport({
            topic,
            module: url.searchParams.get('module') ?? '',
            apiUrl: url.origin,
            identity: request.headers.get('x-actor-id') ?? '',
            installId:
              url.searchParams.get('anonId') ??
              request.headers.get('x-anon-id') ??
              '',
            clientId:
              request.headers.get('x-actor-client-id') ??
              harness.server.createId(),
            getSessionToken: () => url.searchParams.get('token'),
            clock: harness.server.clock,
            timers: harness.server.timers,
            random: harness.server.random,
          });
          pending.set(ticket, transport);
          return Promise.resolve(new Response(null, { status: 101 }));
        },
      };
    },
  };
  return {
    namespace,
    take(ticket: string) {
      const transport = pending.get(ticket);
      pending.delete(ticket);
      if (transport !== undefined) live.add(transport);
      return transport;
    },
    close(transport: ClientTransport) {
      transport.destroy();
      live.delete(transport);
    },
    dispose() {
      for (const transport of [...live, ...pending.values()])
        transport.destroy();
      live.clear();
      pending.clear();
    },
  };
}
