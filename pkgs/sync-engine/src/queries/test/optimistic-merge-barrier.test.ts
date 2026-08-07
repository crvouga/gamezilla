import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  acceptFanoutOnTopic,
  peerApplyMutation,
} from '../../client/peer-apply-mutation';
import { buildMutationFanoutPayload } from '../../shared/mutation-fanout-payload';
import { applyFullMerge } from '../client/merge-applier';
import { createTableChangeBus } from '../client/table-change-bus';
import { scopeHash } from '../shared/canonical';
import {
  createScenarioClients,
  openScenarioDb,
  readWriteEpochFixture,
  rejectThrough,
  scenarioRegistry,
  setNote,
  softAckThrough,
} from './scenario-fixture';

describe('optimistic merge barrier', () => {
  test('in-flight-query-after-upload-ack-does-not-clobber', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const basisBefore = await readWriteEpochFixture(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'local' });
    const ackedEpoch = await softAckThrough(db, 1);
    expect(ackedEpoch).toBeGreaterThan(basisBefore);

    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '10',
      hash: 'h-stale',
      basisEpoch: basisBefore,
      tables: {
        notes: [{ id: 'n1', body: 'server-old', owner_id: 'actor' }],
      },
    });

    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('local');
    const pending = await db.query(sql<{ status: string }>`
      SELECT status FROM _mutations WHERE seq = ${1}
    `);
    expect(pending[0]?.status).toBe('uploaded');
  });

  test('post-ack-fresh-basis-confirms-server-truth', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'local' });
    const ackedEpoch = await softAckThrough(db, 1);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '10',
      hash: 'h-fresh',
      basisEpoch: ackedEpoch,
      tables: {
        notes: [{ id: 'n1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('server');
    const left = await db.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _mutations
    `);
    expect(left[0]?.n).toBe(0);
  });

  test('pending-merge-still-rebases', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const basis = await readWriteEpochFixture(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'local' });
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      basisEpoch: basis,
      tables: {
        notes: [{ id: 'n1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('local');
  });

  test('rejected-upload-not-rebased', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'offline' });
    await rejectThrough(db, 1);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      basisEpoch: 0,
      tables: { notes: [] },
    });
    const after = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'n1'}
    `);
    expect(after.length).toBe(0);
  });

  test('ordered-multi-mutation-rebase', async () => {
    const db = await openScenarioDb();
    const { mutateClient, mergeDeps } = createScenarioClients(db);
    const basis = await readWriteEpochFixture(db);
    await mutateClient.mutate(setNote, { id: 'n1', body: 'first' });
    await mutateClient.mutate(setNote, { id: 'n1', body: 'second' });
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '1',
      hash: 'h',
      basisEpoch: basis,
      tables: {
        notes: [{ id: 'n1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('second');
  });

  test('peer-apply-then-stale-merge-preserves', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const bus = createTableChangeBus();
    const basisBefore = await readWriteEpochFixture(db);
    const payload = buildMutationFanoutPayload({
      mutationId: 'peer-1',
      name: 'setNote',
      args: { id: 'n1', body: 'peer' },
      actorId: 'actor',
      deviceId: 'peer-device',
      accountId: 'acct-1',
      clientId: 'peer-client',
      seq: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(
      acceptFanoutOnTopic({
        topic: 'user:actor',
        payload,
        ctx: { actorId: 'device-1', membershipSpaceIds: [] },
      })
    ).toBe(true);
    const applied = await peerApplyMutation({
      db,
      bus,
      registry: scenarioRegistry,
      topic: 'user:actor',
      payload,
      getChannelsCtx: () => ({
        actorId: 'device-1',
        membershipSpaceIds: [],
      }),
    });
    expect(applied).toBe(true);

    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '5',
      hash: 'h-stale',
      basisEpoch: basisBefore,
      tables: {
        notes: [{ id: 'n1', body: 'server-old', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('peer');
    const peers = await db.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _peer_mutations
    `);
    expect(peers[0]?.n).toBe(1);
  });

  test('peer-apply-then-fresh-basis-allows-server', async () => {
    const db = await openScenarioDb();
    const { mergeDeps } = createScenarioClients(db);
    const bus = createTableChangeBus();
    const payload = buildMutationFanoutPayload({
      mutationId: 'peer-2',
      name: 'setNote',
      args: { id: 'n1', body: 'peer' },
      actorId: 'actor',
      deviceId: 'peer-device',
      accountId: 'acct-1',
      clientId: 'peer-client',
      seq: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await peerApplyMutation({
      db,
      bus,
      registry: scenarioRegistry,
      topic: 'user:actor',
      payload,
      getChannelsCtx: () => ({
        actorId: 'device-1',
        membershipSpaceIds: [],
      }),
    });
    const basisAfter = await readWriteEpochFixture(db);
    const sh = scopeHash('notes', {});
    await applyFullMerge(mergeDeps, {
      scopeHash: sh,
      checkpoint: '6',
      hash: 'h-fresh',
      basisEpoch: basisAfter,
      tables: {
        notes: [{ id: 'n1', body: 'server', owner_id: 'actor' }],
      },
    });
    const notes = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(notes[0]?.body).toBe('server');
    const peers = await db.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _peer_mutations
    `);
    expect(peers[0]?.n).toBe(0);
  });
});
