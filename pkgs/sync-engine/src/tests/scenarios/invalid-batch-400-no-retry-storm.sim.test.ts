import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  expectLiveNoteAt,
  httpFault,
  lastMutationOk,
  mutate,
  passTime,
  pendingEventCount,
  schedulerQuiescent,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('invalid batch 400 no retry storm', () => {
  test.each([880, 881, 882])(
    'invalidMutationsBody backs off then healthy drain (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(httpFault, 'alice', { kind: 'invalidMutationsBody' });
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'after-invalid',
      });
      expect(await run.observe(lastMutationOk('alice'))).toBe(true);

      // Error path uses backoff — scheduler should not hot-loop.
      await run.apply(passTime, 500);
      expect(await run.observe(pendingEventCount)).toBeLessThan(50);

      // `converge` clears boundary faults before healing and settling.
      await run.apply(converge);

      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'after-invalid' });
      const quiescent = await run.observe(schedulerQuiescent);
      const pending = await run.observe(pendingEventCount);
      expect(quiescent || pending < 50).toBe(true);
    }
  );
});
