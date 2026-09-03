import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  restart,
  setNote,
  syncVirtualHost,
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
    await using run = await script(acmeSystem, {
      seed: 7,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hello' });
    await run.elapse(PEER_VISIBLE_BUDGET_MS + 50);

    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'hello' });
    await expectConverged(run);
  });

  test('crash + restart rehydrates from server', async () => {
    await using run = await script(acmeSystem, {
      seed: 23,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectConverged(run);

    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'y' });
    await expectConverged(run);

    await run.apply(restart, 'bob', {});
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'x' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'y' });
  });
});
