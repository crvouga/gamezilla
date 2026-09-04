import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  restart,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

/** Happy-path latency budget components (simulated ms). */
const IMMEDIATE_DRAIN_MS = 0;
const REPLAY_PUBLISH_MS = 40;
const PUBSUB_HOP_MS = 40;
const PEER_VISIBLE_BUDGET_MS =
  IMMEDIATE_DRAIN_MS + REPLAY_PUBLISH_MS + PUBSUB_HOP_MS;

describe('live fanout peer visibility within budget', () => {
  test('happy path: peer sees note without waiting for full settle', async () => {
    await using s = await acmeSystem.script({
      seed: 7,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hello' });
    await s.elapse(PEER_VISIBLE_BUDGET_MS + 50);

    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'hello' });
    await expectConverged(s);
  });

  test('crash + restart rehydrates from server', async () => {
    await using s = await acmeSystem.script({
      seed: 23,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'y' });
    await expectConverged(s);

    await s.apply(restart, 'bob', {});
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'x' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'y' });
  });
});
