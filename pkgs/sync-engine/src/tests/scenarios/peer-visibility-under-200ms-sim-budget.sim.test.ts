import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { RELIABLE_FAULTS } from '../../sim/faults';
import type { SyncAction } from '../../sim/scenario';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  nodeNow,
  noteBodyIs,
  playActions,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

/** Fixed one-hop latency on every node, so the budget is not trivially zero. */
const HOP_LATENCY: readonly SyncAction[] = ['alice', 'bob', 'server'].map(
  (nodeId) => ({
    kind: 'setFaults',
    nodeId,
    traffic: 'all',
    faults: {
      ...RELIABLE_FAULTS,
      latencyMeanMs: PUBSUB_HOP_MS,
      latencyJitterMs: 0,
    },
  })
);

describe('peer visibility under 200ms sim budget', () => {
  test('peer visibility under 200ms sim time', async () => {
    expect(PEER_VISIBLE_BUDGET_MS).toBeLessThan(200);
    await using run = await start(acmeSystem, {
      seed: 19,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(playActions, HOP_LATENCY);
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    const t0 = await run.observe(nodeNow('bob'));
    await run.apply(mutate, 'alice', setNote, { id: 'fast', body: 'y' });
    await untilAcme(run, liveNote('bob', 'fast'), {
      maxMs: 400,
      stepMs: 10,
      pred: noteBodyIs('y'),
    });
    const at = await run.observe(nodeNow('bob'));
    expect(at - t0).toBeLessThan(200);
  });
});
