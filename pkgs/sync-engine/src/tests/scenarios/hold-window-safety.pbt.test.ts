import { describe, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import {
  acmeKnobs,
  acmeSystem,
  clientIds,
  expectConverged,
  hold,
  liveNote,
  mutate,
  release,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('hold window safety PBT', () => {
  test(
    'optimistic body never reverts while sync is held after local mutate',
    async () => {
      await assertProperty(
        'hold window no flicker',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.string({ minLength: 1, maxLength: 12 }),
          async (seed, knobs, body) => {
            await using run = await script(acmeSystem, {
              seed,
              host: syncVirtualHost(),
              knobs: acmeKnobs(knobs),
              properties: [],
            });

            const clientId = (await run.observe(clientIds))[0];
            if (clientId === undefined) return;
            const noteId = 'n0';
            await run.apply(hold, clientId, 'sync');
            await run.apply(mutate, clientId, setNote, {
              id: noteId,
              body,
              title: '',
            });

            for (let i = 0; i < 8; i += 1) {
              const row = await run.observe(liveNote, clientId, noteId);
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
              await run.elapse(25);
            }

            await run.apply(release, clientId, 'sync');
            await expectConverged(run);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
