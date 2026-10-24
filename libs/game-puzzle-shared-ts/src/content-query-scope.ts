import sql, { join, type Sql } from '@pkgs/sql-root-shared-ts/sql';
import { z } from 'zod';
import { contentId } from './content-types';

/** Small pages bound both each response and the number of immutable bodies it carries. */
export const CONTENT_PAGE_SIZE = 32;
export const contentPageParams = z
  .object({
    gameId: contentId,
    afterId: z.string().max(160).default(''),
    documentId: contentId.optional(),
  })
  .strict();
export const contentEditionParams = z
  .object({ ids: z.array(contentId).min(1).max(CONTENT_PAGE_SIZE) })
  .strict();
export const contentCopyParams = z
  .object({ documentId: contentId, afterId: z.string().max(160).default('') })
  .strict();

export function contentIds(ids: readonly string[]): Sql<unknown> {
  return ids.length === 0 ? sql`${''}` : join(ids.map((id) => sql`${id}`));
}

export function contentPageCondition(
  params: z.infer<typeof contentPageParams>
): Sql<unknown> {
  return params.documentId === undefined
    ? sql`id > ${params.afterId}`
    : sql`id = ${params.documentId}`;
}
