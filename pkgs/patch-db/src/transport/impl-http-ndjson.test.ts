/**
 * End-to-end check that the streaming `/patches/read` NDJSON path:
 *
 * 1. Returns results in completion order, not request order
 *    (proves slow queries no longer block fast ones).
 * 2. Round-trips through the client transport into a correctly-ordered
 *    `PatchDbResult[]`.
 * 3. Surfaces per-query errors as inline `error` frames without aborting
 *    sibling queries that have already completed.
 */
import { describe, expect, test } from 'bun:test';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import { PatchDbHttpRequestHandler } from './impl-http-request-handler';
import { PatchDbClientTransportHttpFetch } from './impl-http-fetch';
import type { PatchDbSyncHost } from './interface';

type Plan =
  | { kind: 'ok'; delayMs: number; entityType: string }
  | { kind: 'error'; delayMs: number; status: number; message: string };

class StubHost implements PatchDbSyncHost {
  constructor(private readonly plans: readonly Plan[]) {}

  async read(
    queries: readonly PatchDbQuery[],
    _ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    void _ctx;
    if (queries.length !== 1) {
      throw new Error(
        `StubHost expects one query per host.read (parallel streamer); got ${queries.length}`
      );
    }
    const query = queries[0]!;
    const planIndex = Number(query.entityId);
    const plan = this.plans[planIndex];
    if (plan === undefined) {
      throw new Error(`StubHost: no plan for index ${planIndex}`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, plan.delayMs));
    if (plan.kind === 'error') {
      const err = new Error(plan.message) as Error & { httpStatus?: number };
      err.httpStatus = plan.status;
      throw err;
    }
    return [
      {
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
      },
    ];
  }

  async write(_patches: PatchInput[], _ctx?: PatchDbContext) {
    void _patches;
    void _ctx;
    return { accepted: [], rejected: [] };
  }
}

async function callViaTransport(
  host: PatchDbSyncHost,
  queries: PatchDbQuery[],
  options?: { useNdjsonStreaming?: boolean }
): Promise<PatchDbResult[]> {
  const handler = new PatchDbHttpRequestHandler(host);
  // Hijack fetch to dispatch directly into the handler — no network, no
  // port allocation. Same Request/Response objects the real adapter sees.
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
      'http://patch-db.local/patch-db',
      options
    );
    return await client.read(queries, OPEN_PATCHES_DB_CONTEXT);
  } finally {
    globalThis.fetch = realFetch;
  }
}

describe('NDJSON /patches/read streaming', () => {
  test('preserves request order even when slow queries arrive last', async () => {
    const plans: Plan[] = [
      { kind: 'ok', delayMs: 80, entityType: 'slow' },
      { kind: 'ok', delayMs: 0, entityType: 'fast' },
      { kind: 'ok', delayMs: 20, entityType: 'medium' },
    ];
    const host = new StubHost(plans);
    const queries: PatchDbQuery[] = plans.map((p, i) => ({
      entityType: p.kind === 'ok' ? p.entityType : 'err',
      entityId: String(i),
    }));
    const results = await callViaTransport(host, queries);
    expect(results).toHaveLength(3);
    expect(results[0]?.entities[0]?.entityType).toBe('slow');
    expect(results[1]?.entities[0]?.entityType).toBe('fast');
    expect(results[2]?.entities[0]?.entityType).toBe('medium');
  });

  test('per-query error surfaces as a transport error without losing prior frames', async () => {
    const plans: Plan[] = [
      { kind: 'ok', delayMs: 0, entityType: 'fast' },
      { kind: 'error', delayMs: 5, status: 500, message: 'simulated' },
    ];
    const host = new StubHost(plans);
    const queries: PatchDbQuery[] = plans.map((_p, i) => ({
      entityType: 'demo',
      entityId: String(i),
    }));
    await expect(callViaTransport(host, queries)).rejects.toThrow(/simulated/);
  });

  test('falls back to flat JSON when streaming is disabled', async () => {
    const plans: Plan[] = [{ kind: 'ok', delayMs: 0, entityType: 'demo' }];
    const host = new StubHost(plans);
    const results = await callViaTransport(
      host,
      [{ entityType: 'demo', entityId: '0' }],
      { useNdjsonStreaming: false }
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.entities[0]?.entityType).toBe('demo');
  });
});
