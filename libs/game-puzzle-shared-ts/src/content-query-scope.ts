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
/** Browse pages run newest publication first; the id breaks ties so pages never overlap. */
export const PUBLISHED_PAGE_START = {
  beforeAt: '9999-12-31T23:59:59.999Z',
  beforeId: '',
} as const;
export const contentPublishedParams = z
  .object({
    gameId: contentId,
    beforeAt: z.string().max(40).default(PUBLISHED_PAGE_START.beforeAt),
    beforeId: z.string().max(160).default(PUBLISHED_PAGE_START.beforeId),
  })
  .strict();
export type PublishedPageCursor = {
  readonly beforeAt: string;
  readonly beforeId: string;
};

/** The order Browse shows publications in, on the server and in the local mirror alike. */
export const byNewestPublication = (
  a: { readonly id: string; readonly published_at: string | null },
  b: { readonly id: string; readonly published_at: string | null }
): number => {
  const left = `${a.published_at ?? ''}\u0000${a.id}`;
  const right = `${b.published_at ?? ''}\u0000${b.id}`;
  return left < right ? 1 : left > right ? -1 : 0;
};

export function contentPublishedCondition(
  cursor: PublishedPageCursor
): Sql<unknown> {
  return sql`(published_at < ${cursor.beforeAt} OR (published_at = ${cursor.beforeAt} AND id < ${cursor.beforeId}))`;
}
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
