import {
  createInMemoryPubSub,
  type InMemoryPubSub,
} from '@pkgs/pubsub/testing';
import { sql } from '@pkgs/sql';
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { defineMutation } from '../mutations/core/define-mutation';
import { registry as mutationRegistryOf } from '../mutations/core/registry';
import { createTableChangeBus } from '../queries/client/table-change-bus';
import { openScenarioDb, setNote } from '../queries/test/scenario-fixture';
import {
  buildMutationFanoutPayload,
  parseMutationFanout,
} from '../shared/mutation-fanout-payload';
import { acceptFanoutOnTopic, peerApplyMutation } from './peer-apply-mutation';
import { publishMutationFanout } from './publish-mutation-fanout';

describe('mutation-fanout-payload', () => {
  test('parse accepts v1 mutation and rejects nudges', () => {
    const payload = buildMutationFanoutPayload({
      mutationId: 'm1',
      name: 'setNote',
      args: { id: 'n1', body: 'hi' },
      actorId: 'actor1',
      deviceId: 'd1',
      accountId: 'actor1',
      clientId: 'c1',
      seq: 1,
      createdAt: 't',
    });
    expect(parseMutationFanout(payload)).toEqual(payload);
    expect(parseMutationFanout({ checkpoint: '1', tables: ['notes'] })).toBe(
      null
    );
    expect(parseMutationFanout({})).toBe(null);
  });
});

describe('acceptFanoutOnTopic', () => {
  const base = buildMutationFanoutPayload({
    mutationId: 'm1',
    name: 'setNote',
    args: {},
    actorId: 'actor1',
    deviceId: 'd1',
    accountId: null,
    clientId: 'c1',
    seq: 1,
    createdAt: 't',
  });

  test('user topic requires matching actorId', () => {
    expect(
      acceptFanoutOnTopic({
        topic: 'user:actor1',
        payload: base,
        ctx: { actorId: 'peer', membershipSpaceIds: [] },
      })
    ).toBe(true);
    expect(
      acceptFanoutOnTopic({
        topic: 'user:other',
        payload: base,
        ctx: { actorId: 'peer', membershipSpaceIds: [] },
      })
    ).toBe(false);
  });

  test('room topic requires membership', () => {
    expect(
      acceptFanoutOnTopic({
        topic: 'room:space_a',
        payload: base,
        ctx: { actorId: 'peer', membershipSpaceIds: ['space_a'] },
      })
    ).toBe(true);
    expect(
      acceptFanoutOnTopic({
        topic: 'room:space_a',
        payload: base,
        ctx: { actorId: 'peer', membershipSpaceIds: [] },
      })
    ).toBe(false);
  });
});

describe('peerApplyMutation', () => {
  test('applies once and skips self-echo / replay', async () => {
    const db = await openScenarioDb();
    const bus = createTableChangeBus();
    const registry = mutationRegistryOf([setNote]);
    const payload = buildMutationFanoutPayload({
      mutationId: 'fanout-1',
      name: 'setNote',
      args: { id: 'n1', body: 'from-peer' },
      actorId: 'actor1',
      deviceId: 'd1',
      accountId: 'actor1',
      clientId: 'c-remote',
      seq: 3,
      createdAt: new Date().toISOString(),
    });

    const first = await peerApplyMutation({
      db,
      bus,
      registry,
      topic: 'user:actor1',
      payload,
      getChannelsCtx: () => ({
        actorId: 'actor1',
        membershipSpaceIds: [],
      }),
    });
    expect(first).toBe(true);
    const rows = await db.query(sql<{ body: string }>`
      SELECT body FROM notes WHERE id = ${'n1'}
    `);
    expect(rows[0]?.body).toBe('from-peer');

    const second = await peerApplyMutation({
      db,
      bus,
      registry,
      topic: 'user:actor1',
      payload,
      getChannelsCtx: () => ({
        actorId: 'actor1',
        membershipSpaceIds: [],
      }),
    });
    expect(second).toBe(false);

    await db.run(sql`
      INSERT INTO _mutations (id, name, args, client_id, seq, created_at)
      VALUES (${'own-1'}, ${'setNote'}, ${'{}'}, ${'c-local'}, ${1}, ${'t'})
    `);
    const selfEcho = await peerApplyMutation({
      db,
      bus,
      registry,
      topic: 'user:actor1',
      payload: { ...payload, mutationId: 'own-1' },
      getChannelsCtx: () => ({
        actorId: 'actor1',
        membershipSpaceIds: [],
      }),
    });
    expect(selfEcho).toBe(false);
  });

  test('rejects spoofed user topic', async () => {
    const db = await openScenarioDb();
    const bus = createTableChangeBus();
    const registry = mutationRegistryOf([setNote]);
    const payload = buildMutationFanoutPayload({
      mutationId: 'spoof',
      name: 'setNote',
      args: { id: 'n2', body: 'nope' },
      actorId: 'attacker',
      deviceId: 'd1',
      accountId: null,
      clientId: 'c',
      seq: 1,
      createdAt: 't',
    });
    const ok = await peerApplyMutation({
      db,
      bus,
      registry,
      topic: 'user:victim',
      payload,
      getChannelsCtx: () => ({ actorId: 'victim', membershipSpaceIds: [] }),
    });
    expect(ok).toBe(false);
    const rows = await db.query(sql<{ id: string }>`
      SELECT id FROM notes WHERE id = ${'n2'}
    `);
    expect(rows.length).toBe(0);
  });
});

describe('publishMutationFanout', () => {
  test('publishes to invalidates topics when connected', async () => {
    const pubsub = createInMemoryPubSub() as InMemoryPubSub;
    // In-memory starts connected.
    const received: unknown[] = [];
    pubsub.subscribe('user:actor1', (data) => {
      received.push(data);
    });
    const mut = defineMutation({
      name: 'ping',
      args: z.object({ x: z.number() }),
      writes: ['notes'],
      invalidates: (_a, env) => [`user:${env.actorId}`],
      async run() {
        // no-op
      },
    });
    publishMutationFanout({
      pubsub,
      event: {
        mutationId: 'm-pub',
        mutation: mut,
        args: { x: 1 },
        seq: 1,
        createdAt: 't',
        env: {
          actorId: 'actor1',
          deviceId: 'd1',
          accountId: null,
          isAnon: true,
          now: () => new Date(),
        },
        clientId: 'c1',
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(received.length).toBe(1);
    expect(parseMutationFanout(received[0])?.mutationId).toBe('m-pub');
  });
});
