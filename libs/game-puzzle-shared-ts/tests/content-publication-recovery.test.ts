import { expect, test } from 'bun:test';
import { readContentRevision } from '@libs/game-puzzle-shared-ts/content-store';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { savePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/save-content-draft-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  CONTENT_BODY,
  createContentFixture,
  publishContentFixture,
  withContentFixture,
} from './content-fixture';

// regression: puzzle-publication-retry-blocked-by-refused-edition
test.each(['rivers-first', 'rivers-corrected'])(
  'a refused optimistic edition does not reserve the next publication for %s',
  async (draftId) =>
    withContentFixture(async (fixture) => {
      const { db, env, puzzleContents } = fixture;
      await createContentFixture(fixture, { id: 'river', title: 'River' });
      await publishContentFixture(fixture, 'river');
      const definition = JSON.stringify({
        items: [{ puzzleId: 'river', revisionId: 'river-first' }],
      });
      await createContentFixture(fixture, {
        id: 'rivers',
        title: 'Rivers',
        kind: 'pack',
        definition,
      });
      await publishContentFixture(fixture, 'rivers');
      // The sync engine retains optimistic inserts as tombstones when refused.
      await db.transaction(async (tx) => {
        await tx.run(
          sql`UPDATE puzzle_content_revisions SET deleted_at = ${'1970-01-01T00:00:01.000Z'} WHERE document_id = ${'rivers'}`
        );
        await tx.run(
          sql`UPDATE puzzle_content_pack_items SET deleted_at = ${'1970-01-01T00:00:01.000Z'} WHERE pack_revision_id = ${'rivers-first'}`
        );
        await tx.run(
          sql`UPDATE puzzle_content_documents SET status = ${'draft'}, published_revision_id = ${null}, publication_count = ${0} WHERE id = ${'rivers'}`
        );
      });
      if (draftId !== 'rivers-first')
        await db.transaction((tx) =>
          savePuzzleContentDraftMutation.run(
            { tx, env },
            {
              documentId: 'rivers',
              parentId: 'rivers-first',
              draftId,
              body: { ...CONTENT_BODY, title: 'Corrected rivers', definition },
            }
          )
        );
      await db.transaction((tx) =>
        publishPuzzleContentMutation(puzzleContents).run(
          { tx, env },
          { documentId: 'rivers', draftId }
        )
      );
      expect(await readContentRevision(db, draftId)).toMatchObject({
        edition: 1,
        document_id: 'rivers',
        deleted_at: null,
      });
      expect(
        await db.query(
          sql<{
            puzzle_revision_id: string;
          }>`SELECT puzzle_revision_id FROM puzzle_content_pack_items WHERE pack_revision_id = ${draftId} AND deleted_at IS NULL`
        )
      ).toEqual([{ puzzle_revision_id: 'river-first' }]);
      await db.transaction((tx) =>
        publishPuzzleContentMutation(puzzleContents).run(
          { tx, env },
          { documentId: 'rivers', draftId }
        )
      );
      expect(
        await db.query(
          sql<{
            id: string;
          }>`SELECT id FROM puzzle_content_revisions WHERE document_id = ${'rivers'} AND deleted_at IS NULL`
        )
      ).toEqual([{ id: draftId }]);
    })
);
