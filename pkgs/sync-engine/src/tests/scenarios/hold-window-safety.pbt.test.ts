import { describe, test } from 'bun:test';
import { openDstWorld } from '@pkgs/dst';
import { assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import { syncFacade } from '../../sim/dst';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { isLiveNote, readLiveNotes } from '../apps/acme/assert';
import { acmeDst } from '../apps/acme/dst';
import { setNote } from '../apps/acme/shared/mutations';

describe('hold window safety PBT', () => {
  test(
    'optimistic body never reverts while sync is held after local mutate',
    async () => {
      await assertDstProperty(
        'hold window no flicker',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.string({ minLength: 1, maxLength: 12 }),
          async (seed, knobs, body) => {
            await using world = await openDstWorld(acmeDst, { seed, knobs });
            const facade = syncFacade(world.system);
            const clientId = world.roleIds('client')[0]!;
            const noteId = 'n0';
            const client = facade.clients.get(clientId)!;
            using _hold = facade.net(clientId, 'sync').set('hold');
            await client.mutate(setNote, { id: noteId, body, title: '' });

            for (let i = 0; i < 8; i += 1) {
              const live = await isLiveNote(client.db, noteId);
              if (!live) {
                throw new Error(
                  `note missing during hold seed=${facade.seed.toString(16)}`
                );
              }
              const rows = await readLiveNotes(client.db);
              const current = rows.find((n) => n.id === noteId)?.body;
              if (current !== body) {
                throw new Error(
                  `body reverted during hold: expected ${body}, got ${current}`
                );
              }
              await facade.runFor(25);
            }

            facade.net(clientId, 'sync').set('ok');
            await facade.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
