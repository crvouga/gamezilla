import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  mutate,
  online,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('crash restart rehydrates and drains queue', () => {
  test('offline queue drains after reconnect', async () => {
    await using run = await script(acmeSystem, {
      seed: 40,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    // AppLifecycle offline: requiresOnline gate; upload may still run.
    await run.apply(online, 'alice', false);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
    await run.elapse(50);

    await run.apply(online, 'alice', true);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'queued' });
  });

  test('restart after crash rehydrates all live notes', async () => {
    await using run = await script(acmeSystem, {
      seed: 41,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'two' });
    await expectConverged(run);

    await run.apply(crash, 'bob');
    await run.apply(restart, 'bob', {});
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'one' });
    await expectLiveNoteAt(run, 'bob', 'n2', { body: 'two' });
  });
});
