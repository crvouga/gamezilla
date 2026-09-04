import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  mutate,
  online,
  restart,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('crash restart rehydrates and drains queue', () => {
  test('offline queue drains after reconnect', async () => {
    await using s = await acmeSystem.script({
      seed: 40,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    // AppLifecycle offline: requiresOnline gate; upload may still run.
    await s.apply(online, 'alice', false);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
    await s.elapse(50);

    await s.apply(online, 'alice', true);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'queued' });
  });

  test('restart after crash rehydrates all live notes', async () => {
    await using s = await acmeSystem.script({
      seed: 41,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'two' });
    await expectConverged(s);

    await s.apply(crash, 'bob');
    await s.apply(restart, 'bob', {});
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'one' });
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'two' });
  });
});
