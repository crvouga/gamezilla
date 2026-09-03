import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  lastError,
  liveNote,
  mutate,
  nudge,
  setNote,
  subscribe,
  syncVirtualHost,
  unsubscribe,
} from '../apps/acme';

describe('authorize throw equals denied', () => {
  test('authorize throw detaches scope, keeps domain rows, stays healthy', async () => {
    await using run = await start(acmeSystem, {
      seed: 930,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep-me' });
    await expectConverged(run);
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'keep-me',
    });

    {
      await run.apply(subscribe, 'alice', 'notesAuthorizeThrow', {});
      // Same observable outcome as denied: domain retained, no crash loop.
      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'keep-me',
      });
      expect(await run.observe(lastError('alice'))).toBeNull();
      await run.apply(unsubscribe, 'alice', 'notesAuthorizeThrow');
    }
    // nudge: refresh after denied-scope unsubscribe
    await run.apply(nudge, 'alice');
    expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
      body: 'keep-me',
    });
    await expectConverged(run);
  });

  test.each([931, 932, 933])(
    'seed sweep authorize-throw stays healthy (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(mutate, 'alice', setNote, { id: `n-${seed}`, body: 'x' });
      await expectConverged(run);
      {
        await run.apply(subscribe, 'alice', 'notesAuthorizeThrow', {});
        expect(await run.observe(liveNote('alice', `n-${seed}`))).toMatchObject(
          { body: 'x' }
        );
        await run.apply(unsubscribe, 'alice', 'notesAuthorizeThrow');
      }
      await expectConverged(run);
    }
  );
});
