import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  net,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('same batch posted twice verdicts stable', () => {
  test.each([820, 821, 822])(
    'mesh replay of mutations POST is idempotent (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(net, 'alice', 'sync', {
        ...RELIABLE_FAULTS,
        packetReplayProbability: 1,
      });

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'replay-safe',
      });
      await expectConverged(run);

      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'replay-safe',
      });
      const server = await run.observe(liveNotes('server'));
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
