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

describe('upload response lost retry does not double apply', () => {
  test.each([810, 811, 812])(
    'dropMutationsResponse still one row (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, { id: 'bob' });

      await run.apply(httpFault, 'alice', {
        kind: 'dropMutationsResponse',
      });
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'once' });
      await expectConverged(run);

      expect(await run.observe(liveNote('bob', 'n1'))).toMatchObject({
        body: 'once',
      });
      const server = await run.observe(liveNotes('server'));
      expect(server.filter((r) => r.id === 'n1')).toHaveLength(1);
    }
  );
});
