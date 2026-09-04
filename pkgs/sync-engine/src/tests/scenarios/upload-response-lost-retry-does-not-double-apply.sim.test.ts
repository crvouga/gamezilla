import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  httpFault,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('upload response lost retry does not double apply', () => {
  test.each([810, 811, 812])(
    'dropMutationsResponse still one row (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(httpFault, 'alice', {
        kind: 'dropMutationsResponse',
      });
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'once' });
      await expectConverged(s);

      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'once',
      });
      const server = await s.observe(liveNotes, 'server');
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
