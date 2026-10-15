import {
  importPuzzleCsvBatch,
  PuzzleCsvError,
} from '@libs/chess-puzzle-server/puzzle-import-batch';
import { PuzzleImportRequested } from '@libs/chess-puzzle-shared/puzzle-import-event';
import { puzzleUploadKey } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import { insertOutboxEvent } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-root-shared/sql';
import { schedulePuzzleImportCleanup } from './puzzle-import-cleanup';

export const puzzleImportConsumer = defineOutboxConsumer({
  id: 'chess.import-puzzles',
  delivery: 'background',
  on: PuzzleImportRequested,
  async handler(ctx, payload) {
    // Stop and each part serialize on this row. A stopped or superseded job cannot write again.
    const rows = await ctx.tx.query(sql<{
      requested_by: string;
      total_chunks: number;
      completed_chunks: number;
    }>`
      SELECT requested_by, total_chunks, completed_chunks FROM chess_puzzle_load
      WHERE id = 'dataset' AND source_etag = ${payload.uploadId} AND status = 'adding'
        AND deleted_at IS NULL FOR UPDATE
    `);
    const job = rows[0];
    if (job === undefined || job.completed_chunks !== payload.part) return;
    const nowIso = new Date(ctx.clock.now()).toISOString();
    if (ctx.objectStore === undefined)
      throw new Error('Puzzle import requires object storage.');
    const csv = await readUtf8(
      ctx.objectStore,
      puzzleUploadKey(job.requested_by, payload.uploadId, payload.part)
    );
    if (csv === null) {
      await ctx.tx.run(sql`UPDATE chess_puzzle_load SET status = 'failed', error = 'The uploaded CSV is incomplete. Select the file and start again.',
        finished_at = ${nowIso} WHERE id = 'dataset'`);
      await schedulePuzzleImportCleanup(
        ctx,
        job.requested_by,
        payload.uploadId
      );
      return { notifyUserIds: [job.requested_by] };
    }
    // Parsing happens before SQL; malformed CSV can fail without losing earlier parts.
    let result;
    try {
      result = await importPuzzleCsvBatch(ctx.tx, csv);
    } catch (error) {
      if (!(error instanceof PuzzleCsvError)) throw error;
      await ctx.tx.run(sql`UPDATE chess_puzzle_load SET status = 'failed', error = ${error.message},
        finished_at = ${nowIso} WHERE id = 'dataset'`);
      await schedulePuzzleImportCleanup(
        ctx,
        job.requested_by,
        payload.uploadId
      );
      return { notifyUserIds: [job.requested_by] };
    }
    const counts = await ctx.tx.query(
      sql<{
        count: number;
      }>`SELECT count(*) AS count FROM chess_puzzles WHERE deleted_at IS NULL`
    );
    const poolRows = Number(counts[0]?.count ?? 0);
    const completed = payload.part + 1;
    const finished = completed === job.total_chunks;
    await ctx.tx.run(sql`UPDATE chess_puzzle_load SET
      pool_rows = ${poolRows}, processed_rows = processed_rows + ${result.processed}, inserted_rows = inserted_rows + ${result.inserted},
      updated_rows = updated_rows + ${result.updated}, failed_rows = failed_rows + ${result.rejected},
      duplicate_rows = duplicate_rows + ${result.duplicates}, completed_chunks = ${completed},
      status = ${finished ? 'finished' : 'adding'}, finished_at = ${finished ? nowIso : null}
      WHERE id = 'dataset'`);
    if (finished)
      await schedulePuzzleImportCleanup(
        ctx,
        job.requested_by,
        payload.uploadId
      );
    if (!finished)
      await insertOutboxEvent(ctx.tx, {
        id: `puzzle-import:${payload.uploadId}:${String(completed)}`,
        message: PuzzleImportRequested({
          uploadId: payload.uploadId,
          part: completed,
        }),
        nowIso,
      });
    return { notifyUserIds: [job.requested_by] };
  },
});
