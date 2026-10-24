import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import {
  CONTENT_PAGE_SIZE,
  contentIds,
  contentPageCondition,
  contentPageParams,
} from './content-query-scope';
import { puzzleContentTopic } from './content-topic-map';

/** Only the selected private documents, their current bodies and current public editions. */
export const puzzleContentOwned = defineQuery({
  name: 'puzzleContentOwned',
  params: contentPageParams,
  sampleParams: { gameId: 'game', afterId: '' },
  limit: CONTENT_PAGE_SIZE * 4,
  authorize: queryRequires(PERMISSION.puzzlesReadOwnContent),
  async run(ctx, params) {
    const documents = await ctx.db.query(sql`
      SELECT * FROM puzzle_content_documents
      WHERE owner_id = ${ctx.env.actorId} AND game_id = ${params.gameId}
        AND ${contentPageCondition(params)} ORDER BY id LIMIT ${CONTENT_PAGE_SIZE}
    `);
    const heads = documents.map((row) => String(row['working_draft_id']));
    const editions = documents.flatMap((row) =>
      typeof row['published_revision_id'] === 'string'
        ? [row['published_revision_id']]
        : []
    );
    return {
      puzzle_content_documents: documents,
      puzzle_content_publications: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_publications WHERE owner_id = ${ctx.env.actorId} AND id IN (${contentIds(documents.map((row) => String(row['id'])))}) ORDER BY id`
      ),
      puzzle_content_drafts: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_drafts WHERE owner_id = ${ctx.env.actorId} AND id IN (${contentIds(heads)}) ORDER BY id`
      ),
      puzzle_content_revisions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_revisions WHERE owner_id = ${ctx.env.actorId} AND id IN (${contentIds(editions)}) ORDER BY id`
      ),
    };
  },
});

/** Withdrawal and tombstones remain in the same stable page and update discovery. */
export const puzzleContentPublished = defineQuery({
  name: 'puzzleContentPublished',
  params: contentPageParams,
  sampleParams: { gameId: 'game', afterId: '' },
  limit: CONTENT_PAGE_SIZE * 2,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  entryChannel: () => [puzzleContentTopic],
  async run(ctx, params) {
    const documents = await ctx.db.query(sql`
      SELECT * FROM puzzle_content_publications
      WHERE game_id = ${params.gameId} AND published_revision_id IS NOT NULL
        AND ${contentPageCondition(params)} ORDER BY id LIMIT ${CONTENT_PAGE_SIZE}
    `);
    const ids = documents.map((row) => String(row['published_revision_id']));
    return {
      puzzle_content_publications: documents,
      puzzle_content_revisions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_revisions WHERE id IN (${contentIds(ids)}) ORDER BY id`
      ),
    };
  },
});
