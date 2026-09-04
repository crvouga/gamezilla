import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbSeed, arbSyncArgs } from '../../sim/scenario/args';
import {
  acmeSystem,
  clientIds,
  expectConverged,
  hold,
  liveNote,
  mutate,
  release,
  setNote,
} from '../apps/acme';

describe('hold window safety PBT', () => {
  test(
    'optimistic body never reverts while sync is held after local mutate',
    async () => {
      await assertProperty(
        'hold window no flicker',
        fc.asyncProperty(
          arbSeed(),
          arbSyncArgs(),
          fc.string({ minLength: 1, maxLength: 12 }),
          async (seed, syncArgs, body) => {
            await using s = await acmeSystem.script({
              seed,
              args: syncArgs,
            });

            const clientId = (await s.observe(clientIds))[0];
            if (clientId === undefined) return;
            const noteId = 'n0';
            await s.apply(hold, clientId, 'sync');
            await s.apply(mutate, clientId, setNote, {
              id: noteId,
              body,
              title: '',
            });

            for (let i = 0; i < 8; i += 1) {
              const row = await s.observe(liveNote, clientId, noteId);
              if (row === null || row.deletedAt !== null) {
                throw new Error(
                  `note missing during hold seed=${String(seed)}`
                );
              }
              if (row.body !== body) {
                throw new Error(
                  `body reverted during hold: expected ${body}, got ${row.body}`
                );
              }
              await s.elapse(25);
            }

            await s.apply(release, clientId, 'sync');
            await expectConverged(s);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
