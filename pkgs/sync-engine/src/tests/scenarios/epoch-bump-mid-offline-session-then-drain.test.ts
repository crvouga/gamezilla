import { describe, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  expectLiveNote,
  isLiveNote,
  acmeDomainPack,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('epoch bump mid offline session then drain', () => {
  test.each([720, 721, 722])(
    'offline upgrade drains after later connect (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      // Disconnect so mutate queues without upload (lifecycle online alone
      // still allows HTTP in this sim).
      await a.disconnect();
      await a.mutate(setNote, { id: 'n1', body: 'mid-offline' });
      await world.never(() => isLiveNote(world.server.db, 'n1'), { forMs: 50 });

      // Restart applies epoch wipe on preserved DB; engine reconnects for
      // session sync (sim always boots online). Pending durable uploads drain.
      const alice2 = await world.node('alice').restart({
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await world.assertConverged();

      await expectLiveNote(alice2!.db, 'n1', { body: 'mid-offline' });
      await expectLiveNote(b.db, 'n1', { body: 'mid-offline' });
    }
  );
});
