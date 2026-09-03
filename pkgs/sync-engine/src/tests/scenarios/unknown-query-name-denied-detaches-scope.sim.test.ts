import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  nudge,
  setNote,
  subscribe,
  syncVirtualHost,
} from '../apps/acme';

describe('unknown query name denied detaches scope', () => {
  test.each([780, 781, 782])(
    'unknown query denied keeps domain rows (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
      await expectConverged(run);
      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'keep-me',
      });

      {
        await run.apply(subscribe, 'alice', 'noSuchQueryEver', {});
        expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
          body: 'keep-me',
        });
      }
      // nudge: after denied scope detach, refresh remaining scopes
      await run.apply(nudge, 'alice');
      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'keep-me',
      });
      await expectConverged(run);
    }
  );
});
