import { describe, expect, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
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
} from '../apps/acme';

describe('epoch bump mid offline session then drain', () => {
  test.each([720, 721, 722])(
    'offline upgrade drains after later connect (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      // Disconnect so mutate queues without upload (lifecycle online alone
      // still allows HTTP in this sim).
      await s.apply(disconnect, 'alice');
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'mid-offline',
      });
      await neverAcme(s, (s) => liveNote(s, 'server', 'n1'), { forMs: 50 });

      // Restart applies epoch wipe on preserved DB; engine reconnects for
      // session sync (sim always boots online). Pending durable uploads drain.
      await s.apply(restart, 'alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await expectConverged(s);

      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'mid-offline' });
      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'mid-offline',
      });
    }
  );
});
