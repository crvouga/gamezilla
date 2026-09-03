import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbKnobs, arbSeed } from '../../sim/scenario/knobs';
import {
  acmeKnobs,
  acmeSystem,
  clientIds,
  deleteNote,
  expectConverged,
  expectNoteNotLiveAt,
  liveNote,
  mutate,
  readNoteTombstoneAt,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

type TombstoneStep =
  | { readonly kind: 'set'; readonly body: string }
  | { readonly kind: 'delete' };

describe('tombstone revive PBT', () => {
  test(
    'set/delete interleave converges with consistent live vs tombstone state',
    async () => {
      await assertProperty(
        'tombstone interleave',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.array(
            fc.constantFrom(
              { kind: 'set' as const, body: 'a' },
              { kind: 'set' as const, body: 'b' },
              { kind: 'delete' as const }
            ),
            { minLength: 1, maxLength: 8 }
          ),
          async (seed, knobs, steps) => {
            await using run = await script(acmeSystem, {
              seed,
              host: syncVirtualHost(),
              knobs: acmeKnobs(knobs),
              properties: [],
            });

            const noteId = 'n0';
            let lastBody = '';
            let everSet = false;
            let deleted = false;

            for (const step of steps as TombstoneStep[]) {
              if (step.kind === 'set') {
                everSet = true;
                lastBody = step.body;
                deleted = false;
                await run.apply(mutate, 'c0', setNote, {
                  id: noteId,
                  body: step.body,
                  title: '',
                });
              } else if (everSet) {
                deleted = true;
                await run.apply(mutate, 'c0', deleteNote, { id: noteId });
              }
            }

            await expectConverged(run);

            if (!everSet) return;

            const tomb = await readNoteTombstoneAt(run, 'server', noteId);
            if (deleted) {
              expect(tomb).not.toBeNull();
              await expectNoteNotLiveAt(run, 'c0', noteId);
            } else {
              expect(tomb).toBeNull();
              expect(await run.observe(liveNote, 'c0', noteId)).toMatchObject({
                body: lastBody,
              });
            }
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 90_000 }
  );

  test(
    'revive after delete restores live row on all clients',
    async () => {
      await assertProperty(
        'tombstone revive',
        fc.asyncProperty(
          arbSeed(),
          arbKnobs(),
          fc.string({ maxLength: 8 }),
          fc.string({ maxLength: 8 }),
          async (seed, knobs, body1, body2) => {
            await using run = await script(acmeSystem, {
              seed,
              host: syncVirtualHost(),
              knobs: acmeKnobs(knobs),
              properties: [],
            });

            const noteId = 'n0';
            await run.apply(mutate, 'c0', setNote, {
              id: noteId,
              body: body1,
              title: '',
            });
            await run.apply(mutate, 'c0', deleteNote, { id: noteId });
            await run.apply(mutate, 'c0', setNote, {
              id: noteId,
              body: body2,
              title: '',
            });
            await expectConverged(run);
            for (const peer of await run.observe(clientIds)) {
              expect(await run.observe(liveNote, peer, noteId)).toMatchObject({
                body: body2,
              });
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
