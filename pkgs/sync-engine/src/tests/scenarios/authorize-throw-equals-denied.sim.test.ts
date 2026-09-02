import { describe, expect, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('authorize throw equals denied', () => {
  test('authorize throw detaches scope, keeps domain rows, stays healthy', async () => {
    await using world = await openAcmeWorld({
      seed: 930,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

    {
      using thrown = a.subscribe('notesAuthorizeThrow', {});
      await world.waitUntil(thrown.ready);
      // Same observable outcome as denied: domain retained, no crash loop.
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await expectNotesMatchServer(a.db, world.server.db);
      expect(a.lastError()).toBeNull();
    }
    // nudge: refresh after denied-scope unsubscribe
    await world.waitUntil(a.nudge());
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
    await world.assertConverged();
  });

  test.each([931, 932, 933])(
    'seed sweep authorize-throw stays healthy (seed=%i)',
    async (seed) => {
      await using world = await openAcmeWorld({
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: `n-${seed}`, body: 'x' });
      await world.assertConverged();
      {
        using sub = a.subscribe('notesAuthorizeThrow', {});
        await world.waitUntil(sub.ready);
        await expectLiveNote(a.db, `n-${seed}`, { body: 'x' });
      }
      await world.assertConverged();
    }
  );
});
