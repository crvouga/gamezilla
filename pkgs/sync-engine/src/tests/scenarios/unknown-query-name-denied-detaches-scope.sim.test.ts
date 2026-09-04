import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  nudge,
  setNote,
  subscribe,
} from '../apps/acme';

describe('unknown query name denied detaches scope', () => {
  test.each([780, 781, 782])(
    'unknown query denied keeps domain rows (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
      await expectConverged(s);
      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'keep-me',
      });

      {
        await s.apply(subscribe, 'alice', 'noSuchQueryEver', {});
        expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
          body: 'keep-me',
        });
      }
      // nudge: after denied scope detach, refresh remaining scopes
      await s.apply(nudge, 'alice');
      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'keep-me',
      });
      await expectConverged(s);
    }
  );
});
