import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  httpFault,
  lastMutationOk,
  mutate,
  pendingEventCount,
  schedulerQuiescent,
  setNote,
} from '../apps/acme';

describe('invalid batch 400 no retry storm', () => {
  test.each([880, 881, 882])(
    'invalidMutationsBody backs off then healthy drain (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(httpFault, 'alice', { kind: 'invalidMutationsBody' });
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'after-invalid',
      });
      expect(await s.observe(lastMutationOk, 'alice')).toBe(true);

      // Error path uses backoff — scheduler should not hot-loop.
      await s.elapse(500);
      expect(await s.observe(pendingEventCount)).toBeLessThan(50);

      // `converge` clears boundary faults before healing and settling.
      await expectConverged(s);

      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'after-invalid' });
      const quiescent = await s.observe(schedulerQuiescent);
      const pending = await s.observe(pendingEventCount);
      expect(quiescent || pending < 50).toBe(true);
    }
  );
});
