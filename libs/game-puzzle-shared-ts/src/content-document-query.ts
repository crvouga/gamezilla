import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import {
  CONTENT_PAGE_SIZE,
  contentEditionParams,
  contentIds,
} from './content-query-scope';
import { puzzleContentTopic } from './content-topic-map';

/** Pack builders request only their referenced documents, with private bodies restricted to their author. */
export const puzzleContentDocumentsById = defineQuery({
  name: 'puzzleContentDocumentsById',
  params: contentEditionParams,
  sampleParams: { ids: ['document'] },
  limit: CONTENT_PAGE_SIZE * 3,
  authorize: queryRequires(PERMISSION.puzzlesReadOwnContent),
  entryChannel: (_params, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
  async run(ctx, { ids }) {
    const actor = ctx.env.actorId;
    const documents = (
      await ctx.db.query(
        sql`SELECT * FROM puzzle_content_documents WHERE id IN (${contentIds(ids)}) ORDER BY id`
      )
    ).filter(
      (row) =>
        row['owner_id'] === actor ||
        typeof row['published_revision_id'] === 'string'
    );
    const heads = documents
      .filter((row) => row['owner_id'] === actor)
      .map((row) => String(row['working_draft_id']));
    const editions = documents.flatMap((row) =>
      typeof row['published_revision_id'] === 'string'
        ? [row['published_revision_id']]
        : []
    );
    return {
      puzzle_content_documents: documents,
      puzzle_content_drafts: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_drafts WHERE owner_id = ${actor} AND id IN (${contentIds(heads)}) ORDER BY id`
      ),
      puzzle_content_revisions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_revisions WHERE id IN (${contentIds(editions)}) ORDER BY id`
      ),
    };
  },
});
