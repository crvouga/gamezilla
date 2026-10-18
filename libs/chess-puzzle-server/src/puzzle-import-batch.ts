import {
  isLichessPuzzleHeader,
  validateLichessPuzzleRow,
} from '@libs/chess-puzzle-shared/puzzle-records';
import type { CatalogueRow } from '@libs/game-puzzle-shared/puzzle-catalogue';
import { upsertCatalogueRows } from '@libs/game-puzzle-shared/puzzle-catalogue';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { join } from '@pkgs/sql-root-shared/sql';
import { parse } from 'csv-parse/sync';
import { puzzleTableRowOf } from './row';

export type PuzzleImportCounts = {
  processed: number;
  inserted: number;
  updated: number;
  rejected: number;
  duplicates: number;
};

export class PuzzleCsvError extends Error {}

function validRows(csv: string, counts: PuzzleImportCounts): CatalogueRow[] {
  const records: Record<string, unknown>[] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    max_record_size: 16_000,
    columns(header: string[]) {
      if (!isLichessPuzzleHeader(header)) {
        throw new Error(
          'Choose a Lichess puzzle database CSV with its original header.'
        );
      }
      return header;
    },
  });
  if (records.length > 1000)
    throw new Error('Puzzle source part has too many rows.');
  counts.processed = records.length;
  const rows: CatalogueRow[] = [];
  for (const record of records) {
    const result = validateLichessPuzzleRow(record);
    if (result.ok) rows.push(puzzleTableRowOf(result.puzzle));
    else counts.rejected += 1;
  }
  return rows;
}

async function selectNovelRows(
  tx: SqlTx,
  rows: CatalogueRow[],
  counts: PuzzleImportCounts
): Promise<CatalogueRow[]> {
  if (rows.length === 0) return [];
  const existing = await tx.query(sql<{
    id: string;
    position_key: string | null;
    deleted_at: unknown;
  }>`
    SELECT id, position_key, deleted_at FROM chess_puzzles
    WHERE id IN (${join(rows.map((row) => row.id))})
      OR position_key IN (${join(rows.map((row) => row.position_key))})
  `);
  const byId = new Map(existing.map((row) => [row.id, row]));
  const owners = new Map(
    existing
      .filter((row) => row.position_key !== null)
      .map((row) => [row.position_key, row.id])
  );
  const seen = new Set<string>();
  return rows.filter((row) => {
    const owner = owners.get(row.position_key);
    const prior = byId.get(row.id);
    if (
      seen.has(row.id) ||
      (owner !== undefined && owner !== row.id) ||
      (prior !== undefined && prior.deleted_at !== null)
    ) {
      counts.duplicates += 1;
      return false;
    }
    seen.add(row.id);
    owners.set(row.position_key, row.id);
    if (prior === undefined) counts.inserted += 1;
    else counts.updated += 1;
    return true;
  });
}

/** Validate every position and complete solution before atomically upserting a bounded part. */
export async function importPuzzleCsvBatch(
  tx: SqlTx,
  csv: string
): Promise<PuzzleImportCounts> {
  const counts: PuzzleImportCounts = {
    processed: 0,
    inserted: 0,
    updated: 0,
    rejected: 0,
    duplicates: 0,
  };
  let validated: CatalogueRow[];
  try {
    validated = validRows(csv, counts);
  } catch (error) {
    throw new PuzzleCsvError(
      error instanceof Error ? error.message : String(error)
    );
  }
  const rows = await selectNovelRows(tx, validated, counts);
  if (rows.length === 0) return counts;
  await upsertCatalogueRows(tx, rows);
  return counts;
}
