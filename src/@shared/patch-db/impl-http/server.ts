import type { PubSub } from '../../pub-sub/interface';
import type { PatchesDb, PatchesDbQuery } from '../interface';
import { PATCHES_EVENTS, PATCHES_READ, PATCHES_WRITE } from './shared';

const PATCHES_DB_TOPIC = 'patches-db';

function publishInvalidated(pubSub: PubSub): void {
  pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
}

export function createPatchDbHttpHandlers(
  db: PatchesDb,
  pubSub: PubSub
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (url.pathname === PATCHES_READ && req.method === 'POST') {
      const body = (await req.json()) as { queries: PatchesDbQuery[] };
      const { queries } = body;
      for (const q of queries) {
        if (q.knownPatches?.length) {
          await db.write(q.knownPatches);
          // Do NOT publish here: knownPatches are patches the client already has.
          // Publishing would trigger SSE → poll → knownPatches → infinite loop.
        }
      }
      const results = await db.readEntities(queries);
      return Response.json(results);
    }

    if (url.pathname === PATCHES_WRITE && req.method === 'POST') {
      const body = (await req.json()) as {
        patches: Parameters<PatchesDb['write']>[0];
      };
      const patches = await db.write(body.patches);
      publishInvalidated(pubSub);
      return Response.json(patches);
    }

    if (url.pathname === PATCHES_EVENTS && req.method === 'GET') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const unsub = pubSub.subscribe(PATCHES_DB_TOPIC, () => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'invalidated' })}\n\n`
              )
            );
          });
          req.signal?.addEventListener('abort', () => {
            unsub();
            controller.close();
          });
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  };
}
