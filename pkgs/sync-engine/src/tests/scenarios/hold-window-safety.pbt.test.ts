import { describe, test } from 'bun:test';
import { runProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import { isLiveNote, readLiveNotes } from '../apps/acme/assert';
import { setNote } from '../apps/acme/shared/mutations';
import { openAcmeWorld } from '../apps/acme/system';

describe('hold window safety PBT', () => {
  test(
    'optimistic body never reverts while sync is held after local mutate',
    async () => {
      await runProperty(
        'hold window no flicker',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.string({ minLength: 1, maxLength: 12 }),
          async (seed, knobs, body) => {
            await using world = await openAcmeWorld({ seed, knobs });

            const clientId = world.nodeIds('client')[0]!;
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
              await world.advance(25);
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
