import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { requireContentAuthor } from './content-store';
import { contentId } from './content-types';

export const withdrawPuzzleContentMutation = defineMutation({
  name: 'withdrawPuzzleContent',
  args: z.object({ documentId: contentId }).strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(
      ctx,
      args.documentId,
      PERMISSION.puzzlesPublishContent
    );
    await ctx.tx.run(sql`
      UPDATE puzzle_content_documents SET status = ${'withdrawn'}
      WHERE id = ${doc.id} AND deleted_at IS NULL
    `);
    await ctx.tx.run(sql`
      UPDATE puzzle_content_publications SET status = ${'withdrawn'}
      WHERE id = ${doc.id} AND deleted_at IS NULL
    `);
  },
});
