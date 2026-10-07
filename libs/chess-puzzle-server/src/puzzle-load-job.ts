import {
  CHESS_PUZZLE_OBJECT_KEY,
  PUZZLE_LOAD_STATUS,
  type PuzzleLoadJob,
} from '@libs/chess-puzzle-shared/puzzle-load-job';
import type { Clock } from '@pkgs/clock-shared/types';
import type {
  ObjectStore,
  StoredObject,
} from '@pkgs/object-store-root-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { PuzzleLoadAlreadyRunningError } from './puzzle-load-already-running-error';

export { PuzzleLoadAlreadyRunningError } from './puzzle-load-already-running-error';

const ROWS_PER_POSTGRES_BATCH = 500;
const MAX_ROW_CHARACTERS = 1_000_000;
const LOAD_LOCK = 1_906_198_802;

type StoredJobRow = {
  readonly id: string;
  readonly status: string;
  readonly object_key: string;
  readonly processed_rows: number;
  readonly inserted_rows: number;
  readonly failed_rows: number;
  readonly error: string | null;
  readonly created_at: string;
  readonly finished_at: string | null;
};

type BatchResult = {
  processed: number;
  inserted: number;
  rejected: number;
};

function publicJob(row: StoredJobRow): PuzzleLoadJob {
  if (
    row.status !== PUZZLE_LOAD_STATUS.adding &&
    row.status !== PUZZLE_LOAD_STATUS.finished &&
    row.status !== PUZZLE_LOAD_STATUS.failed
  ) {
    throw new Error(`Unknown puzzle load status: ${row.status}`);
  }
  return {
    id: row.id,
    status: row.status,
    objectKey: row.object_key,
    processedRows: row.processed_rows,
    insertedRows: row.inserted_rows,
    failedRows: row.failed_rows,
    error: row.error,
    startedAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function latestJobQuery() {
  return sql<StoredJobRow>`
    SELECT id, status, object_key, processed_rows, inserted_rows,
           failed_rows, error, created_at, finished_at
    FROM chess_puzzle_load
    WHERE deleted_at IS NULL
      AND status IN (${PUZZLE_LOAD_STATUS.adding}, ${PUZZLE_LOAD_STATUS.finished}, ${PUZZLE_LOAD_STATUS.failed})
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
}

async function startJob(args: {
  readonly db: SqlClient;
  readonly id: string;
  readonly actorId: string;
  readonly nowIso: string;
}): Promise<void> {
  await args.db.transaction(async (tx) => {
    await tx.query(sql<{ readonly locked: unknown }>`
      SELECT public.pg_advisory_xact_lock(${LOAD_LOCK}::bigint) AS locked
    `);
    const active = await tx.query(sql<{ readonly id: string }>`
      SELECT id FROM chess_puzzle_load
      WHERE status = ${PUZZLE_LOAD_STATUS.adding} AND deleted_at IS NULL
      LIMIT 1
    `);
    if (active.length > 0) throw new PuzzleLoadAlreadyRunningError();
    await tx.run(sql<void>`
      INSERT INTO chess_puzzle_load (
        id, created_at, updated_at, source_etag, cursor, finished_at,
        status, requested_by, object_key, processed_rows, inserted_rows,
        failed_rows, error
      ) VALUES (
        ${args.id}, ${args.nowIso}, ${args.nowIso}, 'pending', NULL, NULL,
        ${PUZZLE_LOAD_STATUS.adding}, ${args.actorId},
        ${CHESS_PUZZLE_OBJECT_KEY}, 0, 0, 0, NULL
      )
    `);
  });
}

async function loadBatch(
  db: SqlClient,
  lines: readonly string[],
  nowIso: string
): Promise<BatchResult> {
  const payload = JSON.stringify(lines);
  const rows = await db.query<BatchResult>(sql<BatchResult>`
    WITH source AS (
      SELECT value::jsonb AS item
      FROM jsonb_array_elements_text(${payload}::jsonb)
    ), normalized AS (
      SELECT
        nullif(btrim(item->>'id'), '') AS id,
        nullif(btrim(item->>'fen'), '') AS fen,
        nullif(btrim(item->>'moves'), '') AS moves,
        CASE WHEN jsonb_typeof(item->'rating') = 'number'
          THEN (item->>'rating')::integer END AS rating,
        CASE WHEN jsonb_typeof(item->'rating_deviation') = 'number'
          THEN (item->>'rating_deviation')::integer END AS rating_deviation,
        CASE WHEN jsonb_typeof(item->'popularity') = 'number'
          THEN (item->>'popularity')::integer END AS popularity,
        CASE WHEN jsonb_typeof(item->'nb_plays') = 'number'
          THEN (item->>'nb_plays')::integer END AS nb_plays,
        CASE WHEN jsonb_typeof(item->'themes') = 'array'
          THEN item->'themes' END AS themes,
        nullif(btrim(item->>'game_url'), '') AS game_url,
        CASE WHEN jsonb_typeof(item->'opening_tags') = 'array'
          THEN item->'opening_tags' END AS opening_tags,
        nullif(btrim(item->>'position_key'), '') AS position_key
      FROM source
    ), valid AS (
      SELECT * FROM normalized
      WHERE id IS NOT NULL AND fen IS NOT NULL AND moves IS NOT NULL
        AND rating IS NOT NULL AND rating_deviation IS NOT NULL
        AND popularity IS NOT NULL AND nb_plays IS NOT NULL
        AND themes IS NOT NULL AND opening_tags IS NOT NULL
        AND position_key IS NOT NULL
    ), inserted AS (
      INSERT INTO chess_puzzles (
        id, created_at, updated_at, fen, moves, rating, rating_deviation,
        popularity, nb_plays, themes, game_url, opening_tags, position_key
      )
      SELECT id, ${nowIso}, ${nowIso}, fen, moves, rating, rating_deviation,
             popularity, nb_plays, themes, game_url, opening_tags, position_key
      FROM valid
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT
      (SELECT count(*)::integer FROM source) AS processed,
      (SELECT count(*)::integer FROM inserted) AS inserted,
      ((SELECT count(*) FROM source) - (SELECT count(*) FROM valid))::integer
        AS rejected
  `);
  const result = rows[0];
  if (result === undefined) throw new Error('Postgres returned no load result');
  return result;
}

async function* objectLines(object: StoredObject): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = object.body.getReader();
  let pending = '';
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      pending += decoder.decode(next.value, { stream: true });
      for (;;) {
        const newline = pending.indexOf('\n');
        if (newline < 0) break;
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (line.length > 0) yield line;
      }
      if (pending.length > MAX_ROW_CHARACTERS) {
        throw new Error('Puzzle object contains an oversized row');
      }
    }
    pending += decoder.decode();
    const finalLine = pending.trim();
    if (finalLine.length > 0) yield finalLine;
  } finally {
    reader.releaseLock();
  }
}

async function recordProgress(args: {
  readonly db: SqlClient;
  readonly jobId: string;
  readonly totals: BatchResult;
  readonly nowIso: string;
}): Promise<void> {
  await args.db.run(sql<void>`
    UPDATE chess_puzzle_load
    SET processed_rows = ${args.totals.processed},
        inserted_rows = ${args.totals.inserted},
        failed_rows = ${args.totals.rejected},
        updated_at = ${args.nowIso}
    WHERE id = ${args.jobId} AND deleted_at IS NULL
  `);
}

export class PuzzleLoadJobService {
  constructor(
    private readonly db: SqlClient,
    private readonly store: ObjectStore,
    private readonly clock: Clock,
    private readonly createId: CreateId
  ) {}

  async latest(): Promise<PuzzleLoadJob | null> {
    const row = (await this.db.query(latestJobQuery()))[0];
    return row === undefined ? null : publicJob(row);
  }

  async run(actorId: string): Promise<PuzzleLoadJob> {
    const jobId = this.createId();
    const startedAt = new Date(this.clock.now()).toISOString();
    await startJob({ db: this.db, id: jobId, actorId, nowIso: startedAt });
    try {
      const object = await this.store.get(CHESS_PUZZLE_OBJECT_KEY);
      if (object === null) {
        throw new Error(`Puzzle object not found: ${CHESS_PUZZLE_OBJECT_KEY}`);
      }
      await this.db.run(sql<void>`
        UPDATE chess_puzzle_load
        SET source_etag = ${`bytes:${String(object.size)}`},
            updated_at = ${startedAt}
        WHERE id = ${jobId} AND deleted_at IS NULL
      `);
      const totals: BatchResult = { processed: 0, inserted: 0, rejected: 0 };
      let batch: string[] = [];
      for await (const line of objectLines(object)) {
        batch.push(line);
        if (batch.length < ROWS_PER_POSTGRES_BATCH) continue;
        const result = await loadBatch(this.db, batch, startedAt);
        totals.processed += result.processed;
        totals.inserted += result.inserted;
        totals.rejected += result.rejected;
        batch = [];
        await recordProgress({
          db: this.db,
          jobId,
          totals,
          nowIso: new Date(this.clock.now()).toISOString(),
        });
      }
      if (batch.length > 0) {
        const result = await loadBatch(this.db, batch, startedAt);
        totals.processed += result.processed;
        totals.inserted += result.inserted;
        totals.rejected += result.rejected;
      }
      const finishedAt = new Date(this.clock.now()).toISOString();
      await recordProgress({ db: this.db, jobId, totals, nowIso: finishedAt });
      await this.db.run(sql<void>`
        UPDATE chess_puzzle_load
        SET status = ${PUZZLE_LOAD_STATUS.finished}, finished_at = ${finishedAt},
            updated_at = ${finishedAt}
        WHERE id = ${jobId} AND deleted_at IS NULL
      `);
    } catch (error) {
      const failedAt = new Date(this.clock.now()).toISOString();
      const message = error instanceof Error ? error.message : String(error);
      await this.db.run(sql<void>`
        UPDATE chess_puzzle_load
        SET status = ${PUZZLE_LOAD_STATUS.failed}, error = ${message},
            finished_at = ${failedAt}, updated_at = ${failedAt}
        WHERE id = ${jobId} AND deleted_at IS NULL
      `);
    }
    const job = await this.latest();
    if (job === null || job.id !== jobId)
      throw new Error('Puzzle load job disappeared');
    return job;
  }
}
