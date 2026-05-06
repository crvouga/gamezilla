import type { PatchDb } from '@gamezilla/patch-db/interface';
import { Hono } from 'hono';
import type { HttpBearerAuthPorts } from '../auth/ports';
import type { ApiWorkerEnv } from '../config/env';
import { ACTOR_ID_HEADER, authorizeSpaceDoWebSocket } from './space-do-auth';

/**
 * WebSocket upgrade → {@link Space} Durable Object for a space topic.
 *
 * Query: `topic` — non-empty string (e.g. `space:<uuid>`). Use
 * `encodeURIComponent(topic)` when building the URL.
 * Query: `token` — hosted session JWT (browsers cannot set `Authorization` on `WebSocket`).
 * Query: `anonId` — install UUID; required with `token` for device binding (same as `x-anon-id` on HTTP).
 */
export function createSpaceApp(options: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
}) {
  const { db, bearerAuth } = options;
  return new Hono<{ Bindings: ApiWorkerEnv }>().get('/space/ws', async (c) => {
    const topic = c.req.query('topic');
    if (typeof topic !== 'string' || topic.length === 0) {
      return c.json({ error: 'missing or empty topic query parameter' }, 400);
    }

    const auth = await authorizeSpaceDoWebSocket(
      db,
      c.req.raw,
      topic,
      bearerAuth
    );
    if (auth instanceof Response) {
      return auth;
    }

    const ns = c.env.SPACE;
    if (ns === undefined || ns === null) {
      return c.json({ error: 'SPACE binding not configured' }, 503);
    }
    const id = ns.idFromName(topic);
    const stub = ns.get(id);

    const headers = new Headers(c.req.raw.headers);
    headers.set(ACTOR_ID_HEADER, auth.myId);

    return stub.fetch(
      new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers,
      })
    );
  });
}
