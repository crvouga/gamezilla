/**
 * Sim stand-in for the API Worker's `ROOM` Durable Object binding.
 *
 * The real `/api/room` route resolves the actor, then forwards the WebSocket
 * upgrade to the DO. Sim Hono cannot hand back a `101` socket, so this stub
 * answers the forwarded request with an accept marker carrying the topic and
 * the actor / client ids the route resolved. The loopback listener upgrades
 * the browser socket and bridges it into the in-process room server.
 */

import type { RoomNamespace } from '@libs/auth/public/api-worker-bindings';

const ACCEPT_HEADER = 'x-sim-room-accept';
/** Must match the API route's forwarded headers (`apps/server/src/room/route.ts`). */
const ACTOR_ID_HEADER = 'x-actor-id';
const ACTOR_CLIENT_ID_HEADER = 'x-actor-client-id';

export type SimRoomAccept = {
  readonly topic: string;
  readonly actorId: string;
  readonly clientId: string | null;
};

export function createSimRoomNamespace(): RoomNamespace {
  return {
    idFromName: (name) => ({ name }),
    get: (id) => ({
      fetch: (request) => {
        const topic = (id as { readonly name: string }).name;
        const headers = new Headers({ [ACCEPT_HEADER]: topic });
        const actorId = request.headers.get(ACTOR_ID_HEADER);
        if (actorId !== null) headers.set(ACTOR_ID_HEADER, actorId);
        const clientId = request.headers.get(ACTOR_CLIENT_ID_HEADER);
        if (clientId !== null) headers.set(ACTOR_CLIENT_ID_HEADER, clientId);
        return Promise.resolve(new Response(null, { status: 200, headers }));
      },
    }),
  };
}

/** The accept marker from {@link createSimRoomNamespace}, or `null`. */
export function readSimRoomAccept(response: Response): SimRoomAccept | null {
  const topic = response.headers.get(ACCEPT_HEADER);
  const actorId = response.headers.get(ACTOR_ID_HEADER);
  if (topic === null || actorId === null) return null;
  return {
    topic,
    actorId,
    clientId: response.headers.get(ACTOR_CLIENT_ID_HEADER),
  };
}
