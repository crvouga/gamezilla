import { describe, expect, test } from 'bun:test';
import { PatchDbHookRegistry } from '../../hook-registry';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../../interface';
import {
  shouldSkipTargetedEntityReread,
  type ActiveQuery,
} from '../../impl-sync/active-query-registry';
import {
  buildSyncQueriesForPoll,
  SYNC_POLL_REMOTE_ENTITY_ROW_CAP,
} from '../../impl-sync/impl-sync-poll-helpers';
import { createPatchDbReadBatcher } from '../../scheduling/microtask-batcher';

function emptyResult(q: PatchDbQuery): PatchDbResult {
  return {
    query: q,
    entities: [],
    patches: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
  };
}

function createCountingPatchDb(): PatchDb & {
  readonly readCallCount: () => number;
  readonly lastReadQueryCount: () => number;
} {
  let readCallCount = 0;
  let lastReadQueryCount = 0;
  const db: PatchDb = {
    hooks: new PatchDbHookRegistry(),
    compaction: {
      compactEntity: async () => ({
        removedPatchIds: [],
        compactionPatchId: null,
      }),
      compactAll: async () => ({ entitiesCompacted: 0 }),
    },
    async read(queries, _ctx) {
      void _ctx;
      readCallCount += 1;
      lastReadQueryCount = queries.length;
      return queries.map((q) => emptyResult(q));
    },
    async write() {
      return { accepted: [], rejected: [] };
    },
    async update() {},
  };
  return Object.assign(db, {
    readCallCount: () => readCallCount,
    lastReadQueryCount: () => lastReadQueryCount,
  });
}

describe('createPatchDbReadBatcher', () => {
  test('coalesces multiple read calls in one microtask', async () => {
    const inner = createCountingPatchDb();
    const db = createPatchDbReadBatcher(inner);
    void db.read(
      [{ entityType: 'shape', entityId: 'a', limit: 1 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    void db.read(
      [{ entityType: 'shape', entityId: 'b', limit: 1 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(inner.readCallCount()).toBe(1);
    expect(inner.lastReadQueryCount()).toBe(2);
  });
});

describe('buildSyncQueriesForPoll', () => {
  test('batches first-pass local.read across all active queries', async () => {
    const inner = createCountingPatchDb();
    const mk = (q: PatchDbQuery): ActiveQuery => ({
      query: q,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    });
    const entries: ActiveQuery[] = [
      mk({ entityType: 'todo', limit: 10 }),
      mk({ entityType: 'shape', limit: 5 }),
    ];
    await buildSyncQueriesForPoll(inner, entries);
    expect(inner.readCallCount()).toBe(1);
    expect(inner.lastReadQueryCount()).toBe(2);
  });

  test('second pass batches tracked entity reads when where + patches', async () => {
    let call = 0;
    const inner: PatchDb = {
      hooks: new PatchDbHookRegistry(),
      compaction: {
        compactEntity: async () => ({
          removedPatchIds: [],
          compactionPatchId: null,
        }),
        compactAll: async () => ({ entitiesCompacted: 0 }),
      },
      async read(queries, _ctx) {
        void _ctx;
        call += 1;
        return queries.map((q) => {
          if (q.entityType === 'todo' && q.where !== undefined) {
            return {
              ...emptyResult(q),
              patches: [
                {
                  patchId: 'p1',
                  entityId: 'e1',
                  entityType: 'todo',
                  parentId: null,
                  createdAt: 't',
                  recordedAt: 't',
                  createdBy: '',
                  sessionId: '',
                  attributes: {},
                },
              ],
            };
          }
          return emptyResult(q);
        });
      },
      async write() {
        return { accepted: [], rejected: [] };
      },
      async update() {},
    };
    const mk = (q: PatchDbQuery): ActiveQuery => ({
      query: q,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    });
    await buildSyncQueriesForPoll(inner, [
      mk({
        entityType: 'todo',
        where: { type: 'exists', attribute: 'todo/title' },
        limit: 10,
      }),
    ]);
    expect(call).toBe(2);
  });

  test('poll sync query adds row cap when active query has no limit', async () => {
    const inner = createCountingPatchDb();
    const mk = (q: PatchDbQuery): ActiveQuery => ({
      query: q,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    });
    const syncQs = await buildSyncQueriesForPoll(inner, [
      mk({
        entityType: 'chess.puzzle',
        orderBy: [{ attribute: 'chess.puzzle/popularity', direction: 'desc' }],
      }),
    ]);
    expect(syncQs[0]?.limit).toBe(SYNC_POLL_REMOTE_ENTITY_ROW_CAP);
  });

  test('poll sync query preserves client limit when under cap', async () => {
    const inner = createCountingPatchDb();
    const mk = (q: PatchDbQuery): ActiveQuery => ({
      query: q,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    });
    const syncQs = await buildSyncQueriesForPoll(inner, [
      mk({
        entityType: 'chess.puzzle',
        orderBy: [{ attribute: 'chess.puzzle/popularity', direction: 'desc' }],
        limit: 50,
      }),
    ]);
    expect(syncQs[0]?.limit).toBe(50);
  });

  test('poll sync query clamps client limit above cap', async () => {
    const inner = createCountingPatchDb();
    const mk = (q: PatchDbQuery): ActiveQuery => ({
      query: q,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    });
    const syncQs = await buildSyncQueriesForPoll(inner, [
      mk({ entityType: 'chess.puzzle', limit: 999_999 }),
    ]);
    expect(syncQs[0]?.limit).toBe(SYNC_POLL_REMOTE_ENTITY_ROW_CAP);
  });
});

describe('shouldSkipTargetedEntityReread', () => {
  test('skips unrelated simple entity query when touched is present', () => {
    const q: PatchDbQuery = {
      entityType: 'space',
      entityId: 's1',
      limit: 1,
    };
    const msg = {
      type: 'invalidated' as const,
      touched: [{ entityType: 'space', entityId: 's2' }],
    };
    expect(shouldSkipTargetedEntityReread(q, msg)).toBe(true);
  });

  test('does not skip predicate queries', () => {
    const q: PatchDbQuery = {
      entityType: 'todo',
      where: { type: 'exists', attribute: 'todo/title' },
    };
    const msg = {
      type: 'invalidated' as const,
      touched: [{ entityType: 'todo', entityId: 'x' }],
    };
    expect(shouldSkipTargetedEntityReread(q, msg)).toBe(false);
  });

  test('does not skip when no touched list', () => {
    const q: PatchDbQuery = { entityType: 'space', entityId: 's1', limit: 1 };
    expect(shouldSkipTargetedEntityReread(q, { type: 'invalidated' })).toBe(
      false
    );
  });
});
