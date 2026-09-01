import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('authorize throw equals denied', () => {
  test('authorize throw detaches scope, keeps domain rows, stays healthy', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 930,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

    {
      using thrown = a.subscribe('notesAuthorizeThrow', {});
      await world.until(thrown.ready);
      // Same observable outcome as denied: domain retained, no crash loop.
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await expectNotesMatchServer(a.db, world.server.db);
      expect(a.lastError()).toBeNull();
    }
    // nudge: refresh after denied-scope unsubscribe
    await world.until(a.nudge());
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
    await world.assertConverged();
  });

  test.each([931, 932, 933])(
    'seed sweep authorize-throw stays healthy (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: `n-${seed}`, body: 'x' });
      await world.assertConverged();
      {
        using sub = a.subscribe('notesAuthorizeThrow', {});
        await world.until(sub.ready);
        await expectLiveNote(a.db, `n-${seed}`, { body: 'x' });
      }
      await world.assertConverged();
    }
  );
});
