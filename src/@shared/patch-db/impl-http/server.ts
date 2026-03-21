import { assert, assertArray } from '../../assert';
import type { PubSub } from '../../pub-sub/interface';
import {
  assertAttribute,
  assertEntityKey,
  assertPatchId,
  type PatchesDb,
  type PatchesDbQuery,
  type PatchInput,
} from '../interface';
import { PATCHES_EVENTS, PATCHES_READ, PATCHES_WRITE } from './shared';

function validateQuery(q: unknown): asserts q is PatchesDbQuery {
  assert(
    q !== null && typeof q === 'object' && !Array.isArray(q),
    'Each query must be an object'
  );
  const query = q as Record<string, unknown>;
  if (query['entityType'] !== undefined) {
    assert(
      typeof query['entityType'] === 'string',
      'query.entityType must be string'
    );
  }
  if (query['knownPatches'] !== undefined) {
    assertArray(
      query['knownPatches'],
      'query.knownPatches must be array'
    );
    for (const p of query['knownPatches'] as unknown[]) {
      validatePatchInput(p);
    }
  }
}

function validatePatchInput(p: unknown): asserts p is PatchInput {
  assert(
    p !== null && typeof p === 'object' && !Array.isArray(p),
    'Each patch must be an object'
  );
  const patch = p as Record<string, unknown>;
  assert(
    typeof patch['entityId'] === 'string',
    'patch.entityId must be string'
  );
  assert(
    typeof patch['entityType'] === 'string',
    'patch.entityType must be string'
  );
  assertEntityKey(patch['entityId'], patch['entityType']);
  if (
    patch['patchId'] !== undefined &&
    patch['patchId'] !== null &&
    typeof patch['patchId'] === 'string'
  ) {
    assertPatchId(patch['patchId']);
  }
  assert(
    patch['attributes'] !== null &&
      typeof patch['attributes'] === 'object' &&
      !Array.isArray(patch['attributes']),
    'patch.attributes must be object'
  );
  const attrs = patch['attributes'] as Record<string, unknown>;
  for (const key of Object.keys(attrs)) {
    assertAttribute(key);
  }
}

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
      const body = (await req.json()) as { queries?: unknown };
      assert(
        body !== null && typeof body === 'object' && !Array.isArray(body),
        'Request body must be object'
      );
      assertArray(body.queries, 'queries required');
      assert(body.queries.length > 0, 'queries must not be empty');
      for (const q of body.queries) {
        validateQuery(q);
      }
      const queries = body.queries as PatchesDbQuery[];
      for (const q of queries) {
        if (q.knownPatches?.length) {
          await db.write(q.knownPatches);
          // Do NOT publish here: knownPatches are patches the client already has.
          // Publishing would trigger SSE → poll → knownPatches → infinite loop.
        }
      }
      const results = await db.read(queries);
      return Response.json(results);
    }

    if (url.pathname === PATCHES_WRITE && req.method === 'POST') {
      const body = (await req.json()) as { patches?: unknown };
      assert(
        body !== null && typeof body === 'object' && !Array.isArray(body),
        'Request body must be object'
      );
      assertArray(body.patches, 'patches required');
      assert(body.patches.length > 0, 'patches must not be empty');
      for (const p of body.patches) {
        validatePatchInput(p);
      }
      const patches = await db.write(body.patches as PatchInput[]);
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
