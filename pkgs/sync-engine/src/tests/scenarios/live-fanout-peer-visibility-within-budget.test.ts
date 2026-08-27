import { describe, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import { acmeDomainPack, expectLiveNote, setNote } from '../apps/acme';

/** Happy-path latency budget components (simulated ms). */
const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

describe('live fanout peer visibility within budget', () => {
  test('happy path: peer sees note without waiting for full settle', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 7,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    await a.mutate(setNote, { id: 'n1', body: 'hello' });
    await world.runFor(PEER_VISIBLE_BUDGET_MS + 50);

    await expectLiveNote(b.db, 'n1', { body: 'hello' });
    await world.assertConverged();
  });

  test('crash + restart rehydrates from server', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 23,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'x' });
    await world.assertConverged();

    await a.mutate(setNote, { id: 'n2', body: 'y' });
    await world.assertConverged();

    const bob2 = await world.node('bob').restart();
    await world.assertConverged();
    await expectLiveNote(bob2!.db, 'n1', { body: 'x' });
    await expectLiveNote(bob2!.db, 'n2', { body: 'y' });
  });
});
