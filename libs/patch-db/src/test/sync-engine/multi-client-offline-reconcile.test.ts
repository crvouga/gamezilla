import { describe, expect, test } from 'bun:test';
import type { PatchesDb, PatchesDbResult, PatchInput } from '../../interface';
import type { SimClient } from '../../sim/scenario';
import { DELETED_CLAUSE } from './constants';
import { getTwoClientSim, registerTwoClientSimHooks } from './two-client-sim';

const VIZ_FILE = import.meta.path;

registerTwoClientSimHooks();

const LIST_QUERY = {
  entityType: 'todoList',
  where: DELETED_CLAUSE,
} as const;

function pickEntityIds(results: PatchesDbResult[]): Set<string> {
  return new Set((results[0]?.entities ?? []).map((e) => e.entityId));
}

function getAttr(results: PatchesDbResult[], key: string): unknown {
  return results[0]?.entities[0]?.attributes?.[key];
}

async function writeTodoList(
  writer: SimClient | PatchesDb,
  patches: PatchInput[]
): Promise<void> {
  await writer.write(patches);
}

async function setupSharedList(
  a: SimClient,
  b: SimClient,
  sharedId: string,
  created: string
): Promise<void> {
  await writeTodoList(a, [
    {
      entityId: sharedId,
      entityType: 'todoList',
      attributes: {
        'todoList/name': 'Shared',
        'todoList/order': 0,
        'todoList/createdAt': created,
      },
    },
  ]);
  await a.push();
  await b.poll();
}

async function writeBatchFromA(
  a: SimClient,
  batchIds: string[],
  created: string
): Promise<void> {
  for (const [i, id] of batchIds.entries()) {
    await writeTodoList(a, [
      {
        entityId: id,
        entityType: 'todoList',
        attributes: {
          'todoList/name': `From-A-${i}`,
          'todoList/order': i + 1,
          'todoList/createdAt': created,
        },
      },
    ]);
  }
}

async function divergentEditsWhileOffline(
  b: SimClient,
  bOfflineNew: string,
  sharedId: string,
  created: string
): Promise<void> {
  await writeTodoList(b, [
    {
      entityId: bOfflineNew,
      entityType: 'todoList',
      attributes: {
        'todoList/name': 'Created-by-B-while-offline',
        'todoList/order': 99,
        'todoList/createdAt': created,
      },
    },
  ]);
  await writeTodoList(b, [
    {
      entityId: sharedId,
      entityType: 'todoList',
      attributes: { 'todoList/order': 42 },
    },
  ]);
}

async function assertOfflineVisibility(
  b: SimClient,
  aOnlineBatch: string[],
  sharedId: string,
  bOfflineNew: string
): Promise<void> {
  const bWhileOffline = await b.read([LIST_QUERY]);
  const bOfflineIds = pickEntityIds(bWhileOffline);
  for (const id of aOnlineBatch) {
    expect(bOfflineIds.has(id)).toBe(false);
  }
  expect(bOfflineIds.has(sharedId)).toBe(true);
  expect(bOfflineIds.has(bOfflineNew)).toBe(true);
}

async function readAllIdSets(
  a: SimClient,
  b: SimClient,
  srvDb: PatchesDb
): Promise<{ idsA: Set<string>; idsB: Set<string>; idsR: Set<string> }> {
  const [ra, rb, rr] = await Promise.all([
    a.read([LIST_QUERY]),
    b.read([LIST_QUERY]),
    srvDb.read([LIST_QUERY]),
  ]);
  return {
    idsA: pickEntityIds(ra),
    idsB: pickEntityIds(rb),
    idsR: pickEntityIds(rr),
  };
}

function assertAllHaveIds(
  idsA: Set<string>,
  idsB: Set<string>,
  idsR: Set<string>,
  expectedIds: Iterable<string>
): void {
  for (const id of expectedIds) {
    expect(idsA.has(id)).toBe(true);
    expect(idsB.has(id)).toBe(true);
    expect(idsR.has(id)).toBe(true);
  }
  expect(idsA.size).toBe(idsR.size);
  expect(idsB.size).toBe(idsR.size);
}

async function assertSharedMerged(
  a: SimClient,
  b: SimClient,
  srvDb: PatchesDb,
  sharedId: string
): Promise<void> {
  const mergedName = 'Renamed-by-A-while-B-offline';
  const sharedQuery = { entityType: 'todoList', entityId: sharedId };
  const [sa, sb, sr] = await Promise.all([
    a.read([sharedQuery]),
    b.read([sharedQuery]),
    srvDb.read([sharedQuery]),
  ]);
  expect(getAttr(sa, 'todoList/name')).toBe(mergedName);
  expect(getAttr(sb, 'todoList/name')).toBe(mergedName);
  expect(getAttr(sr, 'todoList/name')).toBe(mergedName);
  expect(getAttr(sa, 'todoList/order')).toBe(42);
  expect(getAttr(sb, 'todoList/order')).toBe(42);
  expect(getAttr(sr, 'todoList/order')).toBe(42);
}

describe('SyncPatchesDb (deterministic sim, multi-client offline)', () => {
  test('offline client diverges then reconciles with server and peer', async () => {
    const sim = getTwoClientSim();
    sim.setMeta({
      enableViz: true,
      title: 'Offline client: partition, divergent edits, reconcile',
      intent:
        'After heal, push/poll merge server + peer changes; attribute conflicts resolve consistently.',
      description:
        'B partitions while A continues online; both edit shared entity; reconcile restores full entity set and merged attributes.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'offline client diverges then reconciles with server and peer',
      },
    });
    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();
    const sharedId = crypto.randomUUID();

    const unsubA = a.subscribe.entities(LIST_QUERY, () => {});
    const unsubB = b.subscribe.entities(LIST_QUERY, () => {});

    await setupSharedList(a, b, sharedId, created);

    b.link.partition();

    const aOnlineBatch = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    await writeBatchFromA(a, aOnlineBatch, created);
    await writeTodoList(a, [
      {
        entityId: sharedId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'Renamed-by-A-while-B-offline' },
      },
    ]);
    await a.push();

    const bOfflineNew = crypto.randomUUID();
    await divergentEditsWhileOffline(b, bOfflineNew, sharedId, created);
    await assertOfflineVisibility(b, aOnlineBatch, sharedId, bOfflineNew);

    b.link.heal();
    await b.push();
    await b.poll();
    await a.poll();
    await sim.scheduler.drain();

    unsubA();
    unsubB();

    const allIds = new Set([sharedId, ...aOnlineBatch, bOfflineNew]);
    const { idsA, idsB, idsR } = await readAllIdSets(a, b, srv.db);
    assertAllHaveIds(idsA, idsB, idsR, allIds);

    await assertSharedMerged(a, b, srv.db, sharedId);

    const bNameA = await a.read([
      { entityType: 'todoList', entityId: bOfflineNew },
    ]);
    expect(getAttr(bNameA, 'todoList/name')).toBe('Created-by-B-while-offline');

    await sim.assertConsistent(LIST_QUERY);
  });
});
