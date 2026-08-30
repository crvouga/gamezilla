import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { isLiveNote, readLiveNotes } from '../apps/acme/assert';
import { acmeDstApp } from '../apps/acme/dst-app';
import { setNote } from '../apps/acme/shared/mutations';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { openWorld } from '../../sim/world';

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
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            const clientId = world.clientIds[0]!;
            const noteId = 'n0';
            const client = world.clients.get(clientId)!;
            using _hold = world.net(clientId, 'sync').set('hold');
            await client.mutate(setNote, { id: noteId, body, title: '' });

            for (let i = 0; i < 8; i += 1) {
              const live = await isLiveNote(client.db, noteId);
              if (!live) {
                throw new Error(
                  `note missing during hold seed=${world.seed.toString(16)}`
                );
              }
              const rows = await readLiveNotes(client.db);
              const current = rows.find((n) => n.id === noteId)?.body;
              if (current !== body) {
                throw new Error(
                  `body reverted during hold: expected ${body}, got ${current}`
                );
              }
              await world.runFor(25);
            }

            world.net(clientId, 'sync').set('ok');
            await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
