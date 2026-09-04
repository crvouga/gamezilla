import { describe, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  acmeSystem,
  addClient,
  disconnect,
  expectConverged,
  liveNote,
  mutate,
  neverAcme,
  restart,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('epoch bump wipes cache preserves pending uploads', () => {
  test.each([710, 711, 712])(
    'offline pending survives epoch bump (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');

      await s.apply(mutate, 'bob', setNote, { id: 'peer', body: 'from-bob' });
      await expectConverged(s);

      await s.apply(disconnect, 'alice');
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
      await neverAcme(s, (s) => liveNote(s, 'server', 'n1'), {
        forMs: 50,
        pred: (v) => v !== null,
      });

      await s.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'queued' });
      await expectLiveNoteAt(s, 'alice', 'peer', { body: 'from-bob' });
      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'queued' });
      await expectLiveNoteAt(s, 'server', 'n1', { body: 'queued' });
    }
  );
});
