import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { z } from 'zod';
import {
  CONTENT_PAGE_SIZE,
  contentCopyParams,
  contentEditionParams,
  contentIds,
} from './content-query-scope';
import { puzzleContentTopic } from './content-topic-map';
import { contentId } from './content-types';

/** Editions that were published remain readable; private drafts never enter this read. */
export const puzzleContentEditions = defineQuery({
  name: 'puzzleContentEditions',
  params: contentEditionParams,
  sampleParams: { ids: ['edition'] },
  limit: CONTENT_PAGE_SIZE * 2,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  entryChannel: () => [puzzleContentTopic],
  async run(ctx, { ids }) {
    const revisions = await ctx.db.query(sql`
      SELECT r.* FROM puzzle_content_revisions r
      INNER JOIN puzzle_content_documents d ON d.id = r.document_id
      WHERE r.id IN (${contentIds(ids)}) AND d.published_revision_id IS NOT NULL ORDER BY r.id
    `);
    const documents = revisions.map((row) => String(row['document_id']));
    return {
      puzzle_content_revisions: revisions,
      puzzle_content_documents: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_documents WHERE id IN (${contentIds(documents)}) ORDER BY id`
      ),
    };
  },
});

export const puzzleContentDraftCopies = defineQuery({
  name: 'puzzleContentDraftCopies',
  params: contentCopyParams,
  sampleParams: { documentId: 'document', afterId: '' },
  limit: CONTENT_PAGE_SIZE,
  authorize: queryRequires(PERMISSION.puzzlesReadOwnContent),
  async run(ctx, { documentId, afterId }) {
    return {
      puzzle_content_drafts: (
        await ctx.db.query(sql`
      SELECT * FROM puzzle_content_drafts WHERE document_id = ${documentId}
        AND owner_id = ${ctx.env.actorId} AND id > ${afterId} ORDER BY id
    `)
      ).slice(0, CONTENT_PAGE_SIZE),
    };
  },
});

/** One selected pack has at most 1,000 stable choices; children hydrate in edition batches. */
export const puzzleContentPackItems = defineQuery({
  name: 'puzzleContentPackItems',
  params: z.object({ revisionId: contentId }).strict(),
  sampleParams: { revisionId: 'edition' },
  limit: 1_000,
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  entryChannel: () => [puzzleContentTopic],
  async run(ctx, { revisionId }) {
    return {
      puzzle_content_pack_items: await ctx.db.query(sql`
      SELECT i.* FROM puzzle_content_pack_items i
      INNER JOIN puzzle_content_revisions r ON r.id = i.pack_revision_id
      INNER JOIN puzzle_content_documents d ON d.id = r.document_id
      WHERE r.id = ${revisionId} AND d.published_revision_id IS NOT NULL ORDER BY i.position, i.id
    `),
    };
  },
});
