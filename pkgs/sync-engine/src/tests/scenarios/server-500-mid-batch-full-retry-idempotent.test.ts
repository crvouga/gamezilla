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

describe('server 500 mid batch full retry idempotent', () => {
  test.each([850, 851, 852])(
    'in-txn fail rolls back then full apply (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      // Fail inside the batch txn after the first mutation attempt → full rollback.
      await s.apply(httpFault, 'alice', {
        kind: 'failMutationsInsideTxnAfter',
        after: 0,
      });
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'txn-atomic',
      });
      await expectConverged(s);

      expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
        body: 'txn-atomic',
      });
      expect(
        (await s.observe(liveNotes, 'server')).filter((r) => r.id === 'n1')
      ).toHaveLength(1);
    }
  );

  test.each([850, 851, 852])(
    'post-commit fail acks via retry dedupe (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed + 10,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, { id: 'bob' });

      await s.apply(httpFault, 'alice', {
        kind: 'failMutationsAfterCommit',
      });
      await s.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'post-commit',
      });
      await expectConverged(s);

      expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
        body: 'post-commit',
      });
      expect(
        (await s.observe(liveNotes, 'server')).filter((r) => r.id === 'n2')
      ).toHaveLength(1);
    }
  );
});
