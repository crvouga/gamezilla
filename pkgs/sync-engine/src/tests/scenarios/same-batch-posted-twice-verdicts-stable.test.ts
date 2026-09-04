import { describe, expect, test } from 'bun:test';
import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  liveNotes,
  mutate,
  net,
  setNote,
} from '../apps/acme';

describe('same batch posted twice verdicts stable', () => {
  test.each([820, 821, 822])(
    'mesh replay of mutations POST is idempotent (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(net, 'alice', 'sync', {
        ...RELIABLE_FAULTS,
        packetReplayProbability: 1,
      });

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'replay-safe',
      });
      await expectConverged(s);

      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'replay-safe',
      });
      const server = await s.observe(liveNotes, 'server');
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
