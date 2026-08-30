import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import {
  expectLiveNote,
  expectNoteNotLive,
  readNoteTombstone,
} from '../apps/acme/assert';
import { acmeDstApp } from '../apps/acme/dst-app';
import { deleteNote, setNote } from '../apps/acme/shared/mutations';
import { arbWorldKnobs, arbWorldSeed } from '../../sim/dst/knobs';
import { openWorld } from '../../sim/world';

type TombstoneStep =
  | { readonly kind: 'set'; readonly body: string }
  | { readonly kind: 'delete' };

describe('tombstone revive PBT', () => {
  test(
    'set/delete interleave converges with consistent live vs tombstone state',
    async () => {
      await assertDstProperty(
        'tombstone interleave',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.array(
            fc.constantFrom(
              { kind: 'set' as const, body: 'a' },
              { kind: 'set' as const, body: 'b' },
              { kind: 'delete' as const }
            ),
            { minLength: 1, maxLength: 8 }
          ),
          async (seed, knobs, steps) => {
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            const noteId = 'n0';
            const client = world.clients.get('c0')!;
            let lastBody = '';
            let everSet = false;
            let deleted = false;

            for (const step of steps as TombstoneStep[]) {
              if (step.kind === 'set') {
                everSet = true;
                lastBody = step.body;
                deleted = false;
                await client.mutate(setNote, {
                  id: noteId,
                  body: step.body,
                  title: '',
                });
              } else if (everSet) {
                deleted = true;
                await client.mutate(deleteNote, { id: noteId });
              }
            }

            await world.assertConverged();

            if (!everSet) return;

            const tomb = await readNoteTombstone(world.server.db, noteId);
            if (deleted) {
              expect(tomb).not.toBeNull();
              await expectNoteNotLive(client.db, noteId);
            } else {
              expect(tomb).toBeNull();
              await expectLiveNote(client.db, noteId, { body: lastBody });
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
      await assertDstProperty(
        'tombstone revive',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.string({ maxLength: 8 }),
          fc.string({ maxLength: 8 }),
          async (seed, knobs, body1, body2) => {
            await using world = await openWorld({
              app: acmeDstApp,
              seed,
              knobs,
            });
            const noteId = 'n0';
            const client = world.clients.get('c0')!;
            await client.mutate(setNote, {
              id: noteId,
              body: body1,
              title: '',
            });
            await client.mutate(deleteNote, { id: noteId });
            await client.mutate(setNote, {
              id: noteId,
              body: body2,
              title: '',
            });
            await world.assertConverged();
            await expectLiveNote(client.db, noteId, { body: body2 });
            for (const peer of world.clients.values()) {
              await expectLiveNote(peer.db, noteId, { body: body2 });
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 90_000 }
  );
});
