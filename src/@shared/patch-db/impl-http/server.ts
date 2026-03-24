import { assert, Assert } from '../../assert';
import type { PubSub } from '../../pub-sub/interface';
import {
  type PatchesDb,
  type PatchInput,
  assertPatch,
  assertPatchInput,
  assertQuery,
  Patch,
  PatchesDbQuery,
} from '../interface';
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
      return handleRead(req, db);
    }

    if (url.pathname === PATCHES_WRITE && req.method === 'POST') {
      return handleWrite(req, db, pubSub);
    }

    if (url.pathname === PATCHES_EVENTS && req.method === 'GET') {
      return handleEvents(req, pubSub);
    }

    return new Response('Not Found', { status: 404 });
  };
}

async function handleEvents(req: Request, pubSub: PubSub): Promise<Response> {
  const url = new URL(req.url);
  assert.equals(url.pathname, PATCHES_EVENTS, 'Invalid path');
  assert.equals(req.method, 'GET', 'Invalid method');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsub = pubSub.subscribe(PATCHES_DB_TOPIC, () => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'invalidated' })}\n\n`)
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

async function handleWrite(
  req: Request,
  db: PatchesDb,
  pubSub: PubSub
): Promise<Response> {
  const url = new URL(req.url);
  assert.equals(url.pathname, PATCHES_WRITE, 'Invalid path');
  assert.equals(req.method, 'POST', 'Invalid method');
  const body: unknown = await req.json();
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  a.field(body, 'patches', 'patches required');
  a.array(body.patches, 'patches required');
  a.ok(body.patches.length > 0, 'patches must not be empty');
  a.all(body.patches, (p): asserts p is PatchInput => assertPatchInput(a, p));
  const patches = await db.write(body.patches);
  publishInvalidated(pubSub);
  return Response.json(patches);
}

async function handleRead(req: Request, db: PatchesDb): Promise<Response> {
  const url = new URL(req.url);
  assert.equals(url.pathname, PATCHES_READ, 'Invalid path');
  assert.equals(req.method, 'POST', 'Invalid method');
  const body: unknown = await req.json();
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  a.field(body, 'queries', 'queries required');
  a.array(body.queries, 'queries required');
  a.ok(body.queries.length > 0, 'queries must not be empty');
  a.all(body.queries, (q): asserts q is PatchesDbQuery => assertQuery(a, q));
  const queries = body.queries;
  const knownPatches = queries.map((q) => q.knownPatches).flat();
  a.all(knownPatches, (p): asserts p is Patch => assertPatch(a, p));
  await db.write(knownPatches);
  const results = await db.read(queries);
  return Response.json(results);
}
