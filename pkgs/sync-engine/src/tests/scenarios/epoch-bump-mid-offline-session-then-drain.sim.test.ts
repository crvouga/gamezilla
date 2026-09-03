import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  disconnect,
  expectConverged,
  expectLiveNoteAt,
  liveNote,
  mutate,
  neverAcme,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('epoch bump mid offline session then drain', () => {
  test.each([720, 721, 722])(
    'offline upgrade drains after later connect (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      // Disconnect so mutate queues without upload (lifecycle online alone
      // still allows HTTP in this sim).
      await run.apply(disconnect, 'alice');
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'mid-offline',
      });
      await neverAcme(run, liveNote('server', 'n1'), { forMs: 50 });

      // Restart applies epoch wipe on preserved DB; engine reconnects for
      // session sync (sim always boots online). Pending durable uploads drain.
      await run.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await expectConverged(run);

      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'mid-offline' });
      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'mid-offline',
      });
    }
  );
});
