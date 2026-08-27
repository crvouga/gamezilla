import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { acmeDstApp } from '../apps/acme/dst-app';
import { isLiveNote, readLiveNotes } from '../apps/acme/assert';
import { setNote } from '../apps/acme/shared/mutations';
import {
  arbWorldKnobs,
  arbWorldSeed,
  openPbtWorld,
} from '../dst/world-config';

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
            const opened = await openPbtWorld({ app: acmeDstApp, seed, knobs });
            const clientId = opened.clientIds[0]!;
            const noteId = 'n0';
            try {
              const client = opened.world.clients.get(clientId)!;
              using _hold = opened.world.net(clientId, 'sync').set('hold');
              await client.mutate(setNote, { id: noteId, body, title: '' });

              for (let i = 0; i < 8; i += 1) {
                const live = await isLiveNote(client.db, noteId);
                if (!live) {
                  throw new Error(
                    `note missing during hold seed=${opened.world.seed.toString(16)}`
                  );
                }
                const rows = await readLiveNotes(client.db);
                const current = rows.find((n) => n.id === noteId)?.body;
                if (current !== body) {
                  throw new Error(
                    `body reverted during hold: expected ${body}, got ${current}`
                  );
                }
                await opened.world.runFor(25);
              }

              opened.world.net(clientId, 'sync').set('ok');
              await opened.world.assertConverged();
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
