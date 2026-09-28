import { describe, test } from 'bun:test';
import {
  addClient,
  connect,
  deleteNote,
  disconnect,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  setNote,
  untilExample,
} from '@pkgs/sync-engine/harness';

/**
 * regression: invariant-dirty-read — found by pending-rebase.property.test.ts.
 * The harness's framework-invariant check read the client DB with a bare query
 * while the upload-verdict transaction was half-applied (rejection row
 * stored, queue row not yet acked), so a refused replay of alice's queued
 * delete reported "rejected mutation still pending". The check now reads
 * through the serialized transaction queue. Timing-exact: keep every step.
 */
describe('framework invariant check sees only committed verdicts', () => {
  test('refused replay of a queued delete does not trip rejected-not-pending', async () => {
    await using s = await exampleSystem.run({
      seed: 7101,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n0', body: 'x' });
    await s.apply(mutate, 'alice', deleteNote, { id: 'n2' });
    await s.apply(mutate, 'alice', deleteNote, { id: 'n0' });
    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'x' });
    await s.apply(mutate, 'bob', setNote, { id: 'n0', body: 'x' });
    await untilExample(s, (x) => liveNote(x, 'server', 'n2'), {
      pred: (v) => v !== null,
    });
    await untilExample(s, (x) => liveNote(x, 'server', 'n0'), {
      pred: (v) => v !== null,
    });

    await s.apply(connect, 'alice');
    await expectInSync(s);
  });
});
