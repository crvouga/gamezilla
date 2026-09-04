import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  lastError,
  liveNote,
  mutate,
  nudge,
  setNote,
  subscribe,
  unsubscribe,
} from '../apps/acme';

describe('authorize throw equals denied', () => {
  test('authorize throw detaches scope, keeps domain rows, stays healthy', async () => {
    await using s = await acmeSystem.script({
      seed: 930,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(s);
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'keep-me',
    });

    {
      await s.apply(subscribe, 'alice', 'notesAuthorizeThrow', {});
      // Same observable outcome as denied: domain retained, no crash loop.
      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'keep-me',
      });
      expect(await s.observe(lastError, 'alice')).toBeNull();
      await s.apply(unsubscribe, 'alice', 'notesAuthorizeThrow');
    }
    // nudge: refresh after denied-scope unsubscribe
    await s.apply(nudge, 'alice');
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'keep-me',
    });
    await expectConverged(s);
  });

  test.each([931, 932, 933])(
    'seed sweep authorize-throw stays healthy (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(mutate, 'alice', setNote, { id: `n-${seed}`, body: 'x' });
      await expectConverged(s);
      {
        await s.apply(subscribe, 'alice', 'notesAuthorizeThrow', {});
        expect(await s.observe(liveNote, 'alice', `n-${seed}`)).toMatchObject({
          body: 'x',
        });
        await s.apply(unsubscribe, 'alice', 'notesAuthorizeThrow');
      }
      await expectConverged(s);
    }
  );
});
