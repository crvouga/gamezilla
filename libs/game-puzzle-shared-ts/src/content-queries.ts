import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { puzzleContentTopic } from './content-topic-map';

/** Own working copies and edition history, including tombstones for reconciliation. */
export const puzzleContentOwned = defineQuery({
  name: 'puzzleContentOwned',
  authorize: queryRequires(PERMISSION.puzzlesReadOwnContent),
  async run(ctx) {
    const actor = ctx.env.actorId;
    const documents = await ctx.db.query(
      sql`SELECT * FROM puzzle_content_documents WHERE owner_id = ${actor}`
    );
    const drafts = await ctx.db.query(
      sql`SELECT * FROM puzzle_content_drafts WHERE owner_id = ${actor}`
    );
    const revisions = await ctx.db.query(
      sql`SELECT * FROM puzzle_content_revisions WHERE owner_id = ${actor}`
    );
    const items = await ctx.db.query(
      sql`SELECT * FROM puzzle_content_pack_items WHERE owner_id = ${actor}`
    );
    return {
      puzzle_content_documents: documents,
      puzzle_content_drafts: drafts,
      puzzle_content_revisions: revisions,
      puzzle_content_pack_items: items,
    };
  },
});

/**
 * Once published, editions remain stable public content. Withdrawal changes
 * discovery, not an edition already used by a pack or a saved attempt. Drafts
 * are never part of this query. Withdrawn document rows still propagate so
 * an already-held catalogue hides them without absence-based garbage collection.
 */
export const puzzleContentPublished = defineQuery({
  name: 'puzzleContentPublished',
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  entryChannel: () => [puzzleContentTopic],
  async run(ctx) {
    const documents = await ctx.db.query(sql`
      SELECT * FROM puzzle_content_documents WHERE published_revision_id IS NOT NULL
    `);
    const revisions = await ctx.db.query(sql`
      SELECT r.* FROM puzzle_content_revisions r
      INNER JOIN puzzle_content_documents d ON d.id = r.document_id
      WHERE d.published_revision_id IS NOT NULL
    `);
    const items = await ctx.db.query(
      sql`SELECT * FROM puzzle_content_pack_items`
    );
    return {
      puzzle_content_documents: documents,
      puzzle_content_revisions: revisions,
      puzzle_content_pack_items: items,
    };
  },
});
