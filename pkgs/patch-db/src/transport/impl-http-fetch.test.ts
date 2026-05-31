/**
 * End-to-end check that the batched JSON `/patches/read` path:
 *
 * 1. Round-trips multiple queries through the client transport into a
 *    correctly-ordered `PatchDbResult[]`.
 * 2. Surfaces server-side `AssertCrashError` through the local crash-handler
 *    chain (so the overlay / telemetry see the original message + context)
 *    and rejects the client promise with the same message.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { AssertCrashError, assert } from '@pkgs/assert';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import { PatchDbHttpRequestHandler } from './http-server';
import { PatchDbClientTransportHttpFetch } from './impl-http-fetch';
import type { PatchDbSyncHost } from './interface';
import { RecordingCrashHandler } from './recording-crash-handler';

type Plan =
  | { kind: 'ok'; entityType: string }
  | {
      kind: 'assertCrash';
      message: string;
      context: Record<string, unknown>;
    };

class StubHost implements PatchDbSyncHost {
  constructor(private readonly plans: readonly Plan[]) {}

  async read(
    queries: readonly PatchDbQuery[],
    _ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    void _ctx;
    return queries.map((query) => {
      const planIndex = Number(query.entityId);
      const plan = this.plans[planIndex];
      if (plan === undefined) {
        throw new Error(`StubHost: no plan for index ${planIndex}`);
      }
      if (plan.kind === 'assertCrash') {
        throw new AssertCrashError(plan.message, plan.context);
      }
      return {
        query,
        entities: [
          {
            entityId: String(planIndex),
            entityType: plan.entityType,
            attributes: { 'demo/seq': String(planIndex) } as unknown as never,
          },
        ],
        patches: [],
        total: 1,
        hasMore: false,
        nextCursor: null,
      };
    });
  }

  async write(_patches: PatchInput[], _ctx?: PatchDbContext) {
    void _patches;
    void _ctx;
    return { accepted: [], rejected: [] };
  }
}

async function callViaTransport(
  host: PatchDbSyncHost,
  queries: PatchDbQuery[]
): Promise<PatchDbResult[]> {
  const handler = new PatchDbHttpRequestHandler(host);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    const res = await handler.handleRequest(req);
    if (res === null) {
      throw new Error('handler did not match request');
    }
    return res;
  }) as typeof fetch;
  try {
    const client = new PatchDbClientTransportHttpFetch(
      'http://patch-db.local/patch-db'
    );
    return await client.read(queries, OPEN_PATCHES_DB_CONTEXT);
  } finally {
    globalThis.fetch = realFetch;
  }
}

describe('batched JSON /patches/read', () => {
  test('returns results in request order', async () => {
    const plans: Plan[] = [
      { kind: 'ok', entityType: 'first' },
      { kind: 'ok', entityType: 'second' },
      { kind: 'ok', entityType: 'third' },
    ];
    const host = new StubHost(plans);
    const queries: PatchDbQuery[] = plans.map((p, i) => ({
      entityType: p.kind === 'ok' ? p.entityType : 'err',
      entityId: String(i),
    }));
    const results = await callViaTransport(host, queries);
    expect(results).toHaveLength(3);
    expect(results[0]?.entities[0]?.entityType).toBe('first');
    expect(results[1]?.entities[0]?.entityType).toBe('second');
    expect(results[2]?.entities[0]?.entityType).toBe('third');
  });
});

describe('AssertCrashError bubbling: server -> client', () => {
  let dispose: (() => void) | null = null;

  afterEach(() => {
    if (dispose !== null) {
      dispose();
      dispose = null;
    }
  });

  test('server AssertCrashError reaches client crash handler with original message + context', async () => {
    const recorder = new RecordingCrashHandler();
    dispose = assert.registerCrashHandler(recorder);

    const message = 'patch-db tiger assert: simulated server crash';
    const context = { entityType: 'demo', attribute: 'demo/x' };
    const plans: Plan[] = [{ kind: 'assertCrash', message, context }];
    const host = new StubHost(plans);
    const queries: PatchDbQuery[] = plans.map((_p, i) => ({
      entityType: 'demo',
      entityId: String(i),
    }));

    let thrown: unknown = null;
    try {
      await callViaTransport(host, queries);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AssertCrashError);
    const err = thrown as AssertCrashError;
    expect(err.message).toBe(message);
    expect(err.context).toEqual(context);

    expect(recorder.captured).toHaveLength(1);
    expect(recorder.captured[0]?.message).toBe(message);
    expect(recorder.captured[0]?.context).toEqual(context);
  });
});

describe('HTTP 500 server errors', () => {
  let dispose: (() => void) | null = null;
  const env = process.env as Record<string, string | undefined>;
  const prevNodeEnv = env['NODE_ENV'];

  afterEach(() => {
    if (dispose !== null) {
      dispose();
      dispose = null;
    }
    if (prevNodeEnv === undefined) delete env['NODE_ENV'];
    else env['NODE_ENV'] = prevNodeEnv;
  });

  test('dev (non-test) HTTP 500 reaches crash handler with status context', async () => {
    env['NODE_ENV'] = 'development';
    const recorder = new RecordingCrashHandler();
    dispose = assert.registerCrashHandler(recorder);

    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'relation missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    const client = new PatchDbClientTransportHttpFetch(
      'http://patch-db.local/patch-db'
    );
    let thrown: unknown = null;
    try {
      await client.write(
        [
          {
            entityId: 'e1',
            entityType: 'demo',
            attributes: { 'demo/x': '1' } as never,
          },
        ],
        OPEN_PATCHES_DB_CONTEXT
      );
    } catch (e) {
      thrown = e;
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(thrown).toBeInstanceOf(AssertCrashError);
    expect(recorder.captured).toHaveLength(1);
    expect(recorder.captured[0]?.context?.['status']).toBe(500);
  });
});
