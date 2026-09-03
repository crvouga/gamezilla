import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  disconnect,
  expectConverged,
  liveNote,
  mutate,
  neverAcme,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('epoch bump wipes cache preserves pending uploads', () => {
  test.each([710, 711, 712])(
    'offline pending survives epoch bump (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');

      await run.apply(mutate, 'bob', setNote, { id: 'peer', body: 'from-bob' });
      await expectConverged(run);

      await run.apply(disconnect, 'alice');
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
      await neverAcme(run, liveNote('server', 'n1'), {
        forMs: 50,
        pred: (v) => v !== null,
      });

      await run.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'queued' });
      await expectLiveNoteAt(run, 'alice', 'peer', { body: 'from-bob' });
      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'queued' });
      await expectLiveNoteAt(run, 'server', 'n1', { body: 'queued' });
    }
  );
});
