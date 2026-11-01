import { expect, test } from 'bun:test';
import { startPuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/start-attempt-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

// regression: cached-pack-requires-derived-membership
test('a cached pack starts its pinned puzzle without materialized membership rows', async () => {
  await withContentFixture(async (fixture) => {
    await createContentFixture(fixture, { id: 'valley', title: 'Valley' });
    await publishContentFixture(fixture, 'valley');
    await createContentFixture(fixture, {
      id: 'rivers',
      title: 'Rivers',
      kind: 'pack',
      definition: JSON.stringify({
        items: [{ puzzleId: 'valley', revisionId: 'valley-first' }],
      }),
    });
    await publishContentFixture(fixture, 'rivers');
    await fixture.db.run(
      sql`UPDATE puzzle_content_pack_items SET deleted_at = ${'2026-11-01T03:41:00.000Z'}`
    );
    await fixture.db.transaction((tx) =>
      startPuzzleAttemptMutation(fixture.puzzleContents).run(
        { tx, env: fixture.env },
        {
          revisionId: 'valley-first',
          packRevisionId: 'rivers-first',
          attemptId: 'offline-attempt',
          positionId: 'offline-position',
        }
      )
    );
    const rows = await fixture.db.query(
      sql<{
        source_id: string;
        pack_revision_id: string;
      }>`SELECT source_id, pack_revision_id FROM puzzle_content_attempts WHERE id = ${'offline-attempt'}`
    );
    expect(rows).toEqual([
      { source_id: 'valley-first', pack_revision_id: 'rivers-first' },
    ]);
    await createContentFixture(fixture, { id: 'outside', title: 'Outside' });
    await publishContentFixture(fixture, 'outside');
    await expect(
      fixture.db.transaction((tx) =>
        startPuzzleAttemptMutation(fixture.puzzleContents).run(
          { tx, env: fixture.env },
          {
            revisionId: 'outside-first',
            packRevisionId: 'rivers-first',
            attemptId: 'outside-attempt',
            positionId: 'outside-position',
          }
        )
      )
    ).rejects.toMatchObject({ code: 'PUZZLE_UNAVAILABLE' });
  });
});
