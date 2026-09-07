/**
 * Browser-safe chess puzzle seed for the playground Commands tab.
 * Avoids `@libs/chess/server` seeder modules that pull `import.meta` / Node paths
 * into the web bundle.
 */

import { chessPuzzlesTopic } from '@libs/chess/public/sync-topics';
import { PuzzleSeedFastPath } from '@libs/chess/root/server/seed-chess-puzzles/fast-path';
import type { PuzzleTableRow } from '@libs/chess/root/server/seed-chess-puzzles/row';
import type { PlaygroundCommand } from '@pkgs/sim-console/client';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { PLAYGROUND_CHESS_PUZZLES_CSV } from '@product/console/playground/playground-chess-fixture';

const BATCH_SIZE = 50;

function readNonNegativeInt(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Minimal RFC4180-ish CSV parse for the playground fixture (quoted cells OK). */
function parseCsvRecords(text: string): Record<string, string>[] {
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

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
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

function recordToPuzzleRow(row: Record<string, string>): PuzzleTableRow | null {
  const id = (row['id'] ?? '').trim();
  const fen = (row['fen'] ?? '').trim();
  const moves = (row['moves'] ?? '').trim();
  if (id.length === 0 || fen.length === 0 || moves.length === 0) return null;
  const gameUrl = (row['game_url'] ?? '').trim();
  return {
    id,
    fen,
    moves,
    rating: readNonNegativeInt(row['rating'] ?? ''),
    rating_deviation: readNonNegativeInt(row['rating_deviation'] ?? ''),
    popularity: readNonNegativeInt(row['popularity'] ?? ''),
    nb_plays: readNonNegativeInt(row['nb_plays'] ?? ''),
    themes: (row['themes'] ?? '[]').trim() || '[]',
    game_url: gameUrl.length > 0 ? gameUrl : null,
    opening_tags: (row['opening_tags'] ?? '[]').trim() || '[]',
  };
}

export async function seedPlaygroundChessPuzzles(args: {
  readonly sqlClient: SqlClient;
  readonly now: () => number;
  readonly createId: () => string;
  readonly notifySyncWake?: (args: {
    readonly topics: readonly string[];
    readonly tables?: readonly string[];
    readonly label: string;
  }) => Promise<void>;
}): Promise<void> {
  const rows: PuzzleTableRow[] = [];
  for (const record of parseCsvRecords(PLAYGROUND_CHESS_PUZZLES_CSV)) {
    const mapped = recordToPuzzleRow(record);
    if (mapped !== null) rows.push(mapped);
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

export function createPlaygroundChessCommands(): PlaygroundCommand[] {
  return [
    {
      id: 'seed-chess-puzzles',
      label: 'Seed chess puzzles',
      async run(ctx) {
        await seedPlaygroundChessPuzzles({
          sqlClient: ctx.serverSql,
          now: ctx.now,
          createId: ctx.createId,
          ...(ctx.notifySyncWake !== undefined
            ? { notifySyncWake: ctx.notifySyncWake }
            : {}),
        });
      },
    },
  ];
}
