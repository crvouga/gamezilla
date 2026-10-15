import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import {
  PuzzleImportCleanup,
  PuzzleImportRequested,
} from './puzzle-import-event';
import { PUZZLE_UPLOAD_MAX_CHUNKS, puzzleUploadKey } from './puzzle-load-job';

export const puzzleUploadIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);

export const startPuzzleImport = defineMutation({
  name: 'startPuzzleImport',
  pendingUx: 'pending',
  requiresOnline: true,
  args: z.object({
    uploadId: puzzleUploadIdSchema,
    filename: z.string().min(1).max(255),
    chunks: z.number().int().min(1).max(PUZZLE_UPLOAD_MAX_CHUNKS),
  }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.puzzlesManage);
    const counts = await ctx.tx.query(
      sql<{
        count: number;
      }>`SELECT count(*) AS count FROM chess_puzzles WHERE deleted_at IS NULL`
    );
    const poolRows = Number(counts[0]?.count ?? 0);
    // One fixed row serializes simultaneous starts, including an empty catalog.
    await ctx.tx.run(sql`
      INSERT INTO chess_puzzle_load (id, source_etag, status, requested_by, object_key,
        processed_rows, inserted_rows, failed_rows, updated_rows, duplicate_rows,
        total_chunks, completed_chunks, cursor, error, finished_at, pool_rows)
      VALUES ('dataset', ${args.uploadId}, 'adding', ${ctx.env.actorId},
        ${puzzleUploadKey(ctx.env.actorId, args.uploadId, 0)}, 0, 0, 0, 0, 0,
        ${args.chunks}, 0, ${args.filename}, NULL, NULL, ${poolRows})
      ON CONFLICT (id) DO UPDATE SET source_etag = excluded.source_etag,
        status = excluded.status, requested_by = excluded.requested_by, object_key = excluded.object_key,
        processed_rows = 0, inserted_rows = 0, failed_rows = 0, updated_rows = 0, duplicate_rows = 0,
        total_chunks = excluded.total_chunks, completed_chunks = 0, cursor = excluded.cursor,
        error = NULL, finished_at = NULL, pool_rows = excluded.pool_rows
      WHERE chess_puzzle_load.status <> 'adding'
    `);
    const active = await ctx.tx.query(
      sql<{
        source_etag: string;
      }>`SELECT source_etag FROM chess_puzzle_load WHERE id = 'dataset'`
    );
    if (active[0]?.source_etag !== args.uploadId) {
      throw new MutationError(
        'PUZZLE_IMPORT_RUNNING',
        'This environment is already adding puzzles.'
      );
    }
    await new Outbox(ctx).send({
      id: `puzzle-import:${args.uploadId}:0`,
      message: PuzzleImportRequested({ uploadId: args.uploadId, part: 0 }),
    });
  },
});

export const stopPuzzleImport = defineMutation({
  name: 'stopPuzzleImport',
  pendingUx: 'pending',
  requiresOnline: true,
  args: z.object({ uploadId: puzzleUploadIdSchema }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.puzzlesManage);
    const jobs = await ctx.tx.query(
      sql<{
        requested_by: string;
      }>`SELECT requested_by FROM chess_puzzle_load WHERE id = 'dataset' AND source_etag = ${args.uploadId}`
    );
    await ctx.tx.run(sql`
      UPDATE chess_puzzle_load SET status = 'stopped', finished_at = ${ctx.env.now().toISOString()}
      WHERE id = 'dataset' AND source_etag = ${args.uploadId} AND status = 'adding'
    `);
    const actorId = jobs[0]?.requested_by;
    if (actorId !== undefined)
      await new Outbox(ctx).send({
        id: `puzzle-import-cleanup:${args.uploadId}`,
        message: PuzzleImportCleanup({ actorId, uploadId: args.uploadId }),
      });
  },
});
