import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { arbSeed, arbSyncArgs } from '../../sim/scenario/args';
import {
  acmeSystem,
  clientIds,
  deleteNote,
  expectConverged,
  expectNoteNotLiveAt,
  liveNote,
  mutate,
  readNoteTombstoneAt,
  setNote,
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
          arbSyncArgs(),
          fc.array(
            fc.constantFrom(
              { kind: 'set' as const, body: 'a' },
              { kind: 'set' as const, body: 'b' },
              { kind: 'delete' as const }
            ),
            { minLength: 1, maxLength: 8 }
          ),
          async (seed, syncArgs, steps) => {
            await using s = await acmeSystem.script({
              seed,
              args: syncArgs,
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
                await s.apply(mutate, 'c0', setNote, {
                  id: noteId,
                  body: step.body,
                  title: '',
                });
              } else if (everSet) {
                deleted = true;
                await s.apply(mutate, 'c0', deleteNote, { id: noteId });
              }
            }

            await expectConverged(s);

            if (!everSet) return;

            const tomb = await readNoteTombstoneAt(s, 'server', noteId);
            if (deleted) {
              expect(tomb).not.toBeNull();
              await expectNoteNotLiveAt(s, 'c0', noteId);
            } else {
              expect(tomb).toBeNull();
              expect(await s.observe(liveNote, 'c0', noteId)).toMatchObject({
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
          arbSyncArgs(),
          fc.string({ maxLength: 8 }),
          fc.string({ maxLength: 8 }),
          async (seed, syncArgs, body1, body2) => {
            await using s = await acmeSystem.script({
              seed,
              args: syncArgs,
            });

            const noteId = 'n0';
            await s.apply(mutate, 'c0', setNote, {
              id: noteId,
              body: body1,
              title: '',
            });
            await s.apply(mutate, 'c0', deleteNote, { id: noteId });
            await s.apply(mutate, 'c0', setNote, {
              id: noteId,
              body: body2,
              title: '',
            });
            await expectConverged(s);
            for (const peer of await s.observe(clientIds)) {
              expect(await s.observe(liveNote, peer, noteId)).toMatchObject({
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
