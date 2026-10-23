import { puzzleContentAttemptsOwned } from '@libs/game-puzzle-shared-ts/attempt-query';
import {
  puzzleContentOwned,
  puzzleContentPublished,
} from '@libs/game-puzzle-shared-ts/content-queries';
import { puzzleContentTopic } from '@libs/game-puzzle-shared-ts/content-topic-map';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import type { QueryCtx } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

export async function exampleContentSnapshot(
  ctx: QueryCtx
): Promise<Readonly<Record<string, readonly QueryRow[]>>> {
  const own = {
    ...(await puzzleContentOwned.run(ctx, {})),
    ...(await puzzleContentAttemptsOwned.run(ctx, {})),
  };
  const publicRows = await puzzleContentPublished.run(ctx, {});
  const tables: Record<string, readonly QueryRow[]> = {};
  for (const name of new Set([
    ...Object.keys(own),
    ...Object.keys(publicRows),
  ])) {
    const rows = new Map<string, QueryRow>();
    for (const row of [...(publicRows[name] ?? []), ...(own[name] ?? [])])
      rows.set(String(row['id']), row);
    tables[name] = [...rows.values()];
  }
  return tables;
}

/** The sync harness opens one session query; it composes the production reads. */
export const exampleContentQuery = defineQuery({
  name: 'puzzleContentExample',
  entryChannel: (_params, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
  authorize: async (ctx) =>
    Boolean(await puzzleContentOwned.authorize?.(ctx, {})) &&
    Boolean(await puzzleContentAttemptsOwned.authorize?.(ctx, {})) &&
    Boolean(await puzzleContentPublished.authorize?.(ctx, {})),
  run: exampleContentSnapshot,
});
