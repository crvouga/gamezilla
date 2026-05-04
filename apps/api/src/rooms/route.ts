import { Hono } from 'hono';
import type { ApiWorkerEnv } from '../config/env';

/**
 * WebSocket upgrade → Durable Object relay for a room topic.
 *
 * Query: `topic` — non-empty string (e.g. `space:<uuid>`). Use
 * `encodeURIComponent(topic)` when building the URL.
 */
export function createRoomRelayApp(): Hono<{ Bindings: ApiWorkerEnv }> {
  return new Hono<{ Bindings: ApiWorkerEnv }>().get('/room/ws', (c) => {
    const topic = c.req.query('topic');
    if (typeof topic !== 'string' || topic.length === 0) {
      return c.json({ error: 'missing or empty topic query parameter' }, 400);
    }
    const ns = c.env.ROOM_RELAY;
    if (ns === undefined || ns === null) {
      return c.json({ error: 'ROOM_RELAY binding not configured' }, 503);
    }
    const id = ns.idFromName(topic);
    const stub = ns.get(id);
    return stub.fetch(c.req.raw);
  });
}
