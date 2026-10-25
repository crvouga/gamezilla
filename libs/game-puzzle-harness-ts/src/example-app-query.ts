import {
  puzzleContentAttemptsOwned,
  puzzleContentPositionsOwned,
} from '@libs/game-puzzle-shared-ts/attempt-query';
import { puzzleContentDraftCopies } from '@libs/game-puzzle-shared-ts/content-detail-queries';
import {
  puzzleContentOwned,
  puzzleContentPublished,
} from '@libs/game-puzzle-shared-ts/content-queries';
import { puzzleContentTopic } from '@libs/game-puzzle-shared-ts/content-topic-map';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import type { QueryCtx } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import {
  exampleReferencedEditions,
  mergeContentSnapshots,
} from './example-query-references';

/** A normal app session can start without holding any puzzle content. */
export const exampleContentBootstrapQuery = defineQuery({
  name: 'puzzleContentBootstrap',
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  async run(ctx) {
    return {
      client_config: await ctx.db.query(sql`SELECT * FROM client_config`),
    };
  },
});

/** A harness app holds the first production pages and explicit selected-content scopes. */
export async function exampleContentSnapshot(
  ctx: QueryCtx,
  gameIds: readonly string[]
): Promise<Readonly<Record<string, readonly QueryRow[]>>> {
  const pages = await Promise.all(
    gameIds.flatMap((gameId) => [
      puzzleContentOwned.run(ctx, { gameId, afterId: '' }),
      puzzleContentPublished.run(ctx, { gameId, afterId: '' }),
      puzzleContentAttemptsOwned.run(ctx, {
        gameId,
        beforeAt: '9999-12-31T23:59:59.999Z',
        beforeOrder: Number.MAX_SAFE_INTEGER,
        beforeId: '',
        unfinishedOnly: false,
      }),
    ])
  );
  const base = mergeContentSnapshots(pages);
  const copies = await Promise.all(
    (base['puzzle_content_documents'] ?? [])
      .filter((row) => row['owner_id'] === ctx.env.actorId)
      .map((row) =>
        puzzleContentDraftCopies.run(ctx, {
          documentId: String(row['id']),
          afterId: '',
        })
      )
  );
  const positions = await Promise.all(
    (base['puzzle_content_attempts'] ?? []).map((row) =>
      puzzleContentPositionsOwned.run(ctx, {
        attemptId: String(row['id']),
        afterId: '',
      })
    )
  );
  const own = mergeContentSnapshots([base, ...copies, ...positions]);
  return mergeContentSnapshots([
    own,
    ...(await exampleReferencedEditions(ctx, own)),
  ]);
}

/** One session query for a harness app over its games' content. */
export function contentSessionQuery(gameIds: readonly string[]) {
  const first = gameIds[0] ?? '';
  return defineQuery({
    name: 'puzzleContentExample',
    entryChannel: (_params, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
    authorize: async (ctx) =>
      Boolean(
        await puzzleContentOwned.authorize?.(ctx, {
          gameId: first,
          afterId: '',
        })
      ) &&
      Boolean(
        await puzzleContentAttemptsOwned.authorize?.(ctx, {
          gameId: first,
          beforeAt: '9999-12-31T23:59:59.999Z',
          beforeOrder: Number.MAX_SAFE_INTEGER,
          beforeId: '',
          unfinishedOnly: false,
        })
      ) &&
      Boolean(
        await puzzleContentPublished.authorize?.(ctx, {
          gameId: first,
          afterId: '',
        })
      ),
    run: (ctx) => exampleContentSnapshot(ctx, gameIds),
  });
}

export const exampleContentQuery = contentSessionQuery([
  'counting',
  'other-counting',
]);
