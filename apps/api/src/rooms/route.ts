import { Hono } from 'hono';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { ApiWorkerEnv } from '../config/env';
import { authorizeRoomWebSocket } from './relay-auth';

/**
 * WebSocket upgrade → {@link Room} Durable Object for a room topic.
 *
 * Query: `topic` — non-empty string (e.g. `space:<uuid>`). Use
 * `encodeURIComponent(topic)` when building the URL.
 * Query: `token` — Bearer session token (required; browsers cannot set
 * `Authorization` on `WebSocket`).
 */
export function createRoomApp(options: { db: PatchDb }) {
  const { db } = options;
  return new Hono<{ Bindings: ApiWorkerEnv }>().get('/room/ws', async (c) => {
    const topic = c.req.query('topic');
    if (typeof topic !== 'string' || topic.length === 0) {
      return c.json({ error: 'missing or empty topic query parameter' }, 400);
    }

    const auth = await authorizeRoomWebSocket(db, c.req.raw, topic);
    if (auth instanceof Response) {
      return auth;
    }

    const ns = c.env.ROOM;
    if (ns === undefined || ns === null) {
      return c.json({ error: 'ROOM binding not configured' }, 503);
    }
    const id = ns.idFromName(topic);
    const stub = ns.get(id);

    const headers = new Headers(c.req.raw.headers);
    headers.set('x-gamezilla-account-id', auth.accountId);

    return stub.fetch(
      new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers,
      })
    );
  });
}
