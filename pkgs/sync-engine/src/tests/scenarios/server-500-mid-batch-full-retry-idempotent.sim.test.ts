import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  httpFault,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('server 500 mid batch full retry idempotent', () => {
  test.each([850, 851, 852])(
    'in-txn fail rolls back then full apply (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      // Fail inside the batch txn after the first mutation attempt → full rollback.
      await run.apply(httpFault, 'alice', {
        kind: 'failMutationsInsideTxnAfter',
        after: 0,
      });
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'txn-atomic',
      });
      await expectConverged(run);

      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'txn-atomic',
      });
      expect(
        (await run.observe(liveNotes('server'))).filter((r) => r.id === 'n1')
      ).toHaveLength(1);
    }
  );

  test.each([850, 851, 852])(
    'post-commit fail acks via retry dedupe (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed + 10,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(httpFault, 'alice', {
        kind: 'failMutationsAfterCommit',
      });
      await run.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'post-commit',
      });
      await expectConverged(run);

      expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
        body: 'post-commit',
      });
      expect(
        (await run.observe(liveNotes('server'))).filter((r) => r.id === 'n2')
      ).toHaveLength(1);
    }
  );
});
