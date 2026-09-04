import { describe, expect, test } from 'bun:test';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  netSet,
  nodeNow,
  noteBodyIs,
  setNote,
  untilAcme,
} from '../apps/acme';

const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

/** Fixed one-hop latency on every node, so the budget is not trivially zero. */
const HOP_LATENCY = {
  ...RELIABLE_FAULTS,
  latencyMeanMs: PUBSUB_HOP_MS,
  latencyJitterMs: 0,
} as const;
const NODES = ['alice', 'bob', 'server'] as const;

describe('peer visibility under 200ms sim budget', () => {
  test('peer visibility under 200ms sim time', async () => {
    expect(PEER_VISIBLE_BUDGET_MS).toBeLessThan(200);
    await using s = await acmeSystem.script({
      seed: 19,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    for (const nodeId of NODES) {
      await s.apply(netSet, nodeId, 'all', HOP_LATENCY);
      await s.elapse(10);
    }
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    const t0 = await s.observe(nodeNow, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'fast', body: 'y' });
    await untilAcme(s, (s) => liveNote(s, 'bob', 'fast'), {
      maxMs: 400,
      stepMs: 10,
      pred: noteBodyIs('y'),
    });
    const at = await s.observe(nodeNow, 'bob');
    expect(at - t0).toBeLessThan(200);
  });
});
