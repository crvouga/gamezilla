import {
  importPuzzleCsvBatch,
  PuzzleCsvError,
} from '@libs/chess-puzzle-server-ts/puzzle-import-batch';
import { PuzzleImportRequested } from '@libs/chess-puzzle-shared-ts/puzzle-import-event';
import { readUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { defineOutboxConsumer } from '@pkgs/outbox-shared-ts/define-consumer';
import { insertOutboxEvent } from '@pkgs/outbox-shared-ts/outbox';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const puzzleImportConsumer = defineOutboxConsumer({
  id: 'chess.import-puzzles',
  delivery: 'background',
  on: PuzzleImportRequested,
  async handler(ctx, payload) {
    // Stop and each part serialize on this row. A stopped or superseded job cannot write again.
    const rows = await ctx.tx.query(sql<{
      requested_by: string;
      object_key: string;
      total_chunks: number;
      completed_chunks: number;
    }>`
      SELECT requested_by, object_key, total_chunks, completed_chunks FROM chess_puzzle_load
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
      `${job.object_key.slice(0, job.object_key.lastIndexOf('/') + 1)}${String(payload.part)}.csv`
    );
    if (csv === null) {
      await ctx.tx.run(sql`UPDATE chess_puzzle_load SET status = 'failed', error = 'The saved Lichess file is incomplete. Puzzles already added remain available.',
        finished_at = ${nowIso} WHERE id = 'dataset'`);
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
