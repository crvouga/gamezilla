/**
 * Browser-safe chess puzzle seed for the web harness host (`bun run dev` /
 * product-harness). Parses the inline CSV fixture and inserts through the
 * same fast path the Node load-file seeder uses, so the dev pool matches the
 * shape of production rows. Avoids `@libs/chess` seeder modules that pull
 * `import.meta` / Node paths into the web bundle.
 */

import type { SqlClient } from '@pkgs/sql-client/interface';
import { chessPuzzlesTopic } from '../public/sync-topics';
import { PuzzleSeedFastPath } from '../root/server/seed-chess-puzzles/fast-path';
import { PuzzleIngestTally } from '../root/server/seed-chess-puzzles/puzzle-ingest';
import type { PuzzleTableRow } from '../root/server/seed-chess-puzzles/row';

import { HARNESS_CHESS_PUZZLES_WEB_CSV } from './chess-puzzles-web-fixture';

const BATCH_SIZE = 50;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

/** Minimal RFC4180-ish CSV parse for the inline fixture (quoted cells OK). */
export function parseHarnessChessPuzzleCsv(
  text: string
): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headerLine = lines[0];
  if (headerLine === undefined || headerLine.length === 0) return [];
  const headers = splitCsvLine(headerLine);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || line.trim().length === 0) continue;
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (key === undefined) continue;
      row[key] = cells[c] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

export type SeedHarnessChessPuzzlesWebArgs = {
  readonly sqlClient: SqlClient;
  readonly now: () => number;
  readonly createId: () => string;
  /** Optional pubsub wake so already-connected clients hydrate the new rows. */
  readonly notifySyncWake?: (args: {
    readonly topics: readonly string[];
    readonly tables?: readonly string[];
    readonly label: string;
  }) => Promise<void>;
};

export async function seedHarnessChessPuzzlesWeb(
  args: SeedHarnessChessPuzzlesWebArgs
): Promise<void> {
  // Same §23 validation pass + dedupe as every other ingest path.
  const tally = new PuzzleIngestTally();
  const rows: PuzzleTableRow[] = [];
  for (const record of parseHarnessChessPuzzleCsv(
    HARNESS_CHESS_PUZZLES_WEB_CSV
  )) {
    const row = tally.accept(record);
    if (row !== null) rows.push(row);
  }
  const fastPath = new PuzzleSeedFastPath(args.sqlClient);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await fastPath.insertPuzzleTableRows(batch, {
      createId: args.createId,
      now: args.now,
    });
  }
  if (args.notifySyncWake !== undefined) {
    await args.notifySyncWake({
      topics: [chessPuzzlesTopic()],
      tables: ['chess_puzzles'],
      label: 'seed-chess-puzzles',
    });
  }
}
