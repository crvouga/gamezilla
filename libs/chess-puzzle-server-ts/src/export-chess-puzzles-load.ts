// @io-wall-ok
/**
 * Export a bounded chess_puzzles CSV load file from Postgres (typically prod).
 *
 *   SECRETS_ENV=prd bun run libs/secrets-server-ts/scripts/secrets-run.ts -- \
 *     bun run --filter @libs/chess-puzzle-server-ts export:puzzles-load -- --confirm-prod
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CatalogueRow } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import { isProductionEnv } from '@libs/infra-shared-ts/env-file';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { openPgClient } from '@pkgs/sql-client-postgres-server-ts/connect';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { raw } from '@pkgs/sql-root-shared-ts/sql';
import { resolveChessPuzzlesLoadFilePath } from './load-file';
import {
  CHESS_PUZZLES_LOAD_CSV_COLUMNS,
  CHESS_PUZZLES_LOAD_EXPORT_SQL,
} from './load-file-constants';
import { PuzzleIngestTally } from './puzzle-ingest';
import { resolveToolingDatabaseUrl } from './tooling-database-url';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const configStore = createRepoTreeObjectStore({ rootDir: REPO_ROOT });

type ExportRow = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating: number;
  readonly rating_deviation: number;
  readonly popularity: number;
  readonly nb_plays: number;
  readonly themes: unknown;
  readonly game_url: string | null;
  readonly opening_tags: unknown;
};

function parseArgs(argv: readonly string[]): { confirmProd: boolean } {
  let confirmProd = false;
  for (const arg of argv) {
    if (arg === '--confirm-prod') {
      confirmProd = true;
      continue;
    }
    assert.fail(`export:puzzles-load: unknown arg ${arg}`);
  }
  return { confirmProd };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function cellToCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return csvEscape(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return csvEscape(String(value));
  }
  return csvEscape(JSON.stringify(value));
}

function rowsToCsv(rows: readonly CatalogueRow[]): string {
  const header = CHESS_PUZZLES_LOAD_CSV_COLUMNS.join(',');
  const lines = rows.map((row) =>
    CHESS_PUZZLES_LOAD_CSV_COLUMNS.map((col) => cellToCsv(row[col])).join(',')
  );
  return `${[header, ...lines].join('\n')}\n`;
}

export async function exportChessPuzzlesLoadFile(
  argv: readonly string[] = process.argv.slice(2)
): Promise<{ readonly outPath: string; readonly rowCount: number }> {
  const { confirmProd } = parseArgs(argv);
  const log = createLogger({
    name: 'chess:export-puzzles-load',
    now: wallClock.now,
  });
  const { databaseUrl, env } = await resolveToolingDatabaseUrl({
    configStore,
    http: createGlobalHttpClient(),
    repoRoot: REPO_ROOT,
    surface: 'chess:export-puzzles-load',
    guardEnv: (active) => {
      if (isProductionEnv(active) && !confirmProd) {
        assert.fail(
          `export:puzzles-load: refusing production SECRETS_ENV=${active.env} without --confirm-prod`
        );
      }
    },
  });

  const outPath = resolveChessPuzzlesLoadFilePath();
  const { sqlClient } = await openPgClient({
    connectionString: databaseUrl,
    dbScope: createPostgresDbScope('public'),
    clientOptions: { application_name: 'export:puzzles-load' },
  });
  try {
    const stored = await sqlClient.query(
      raw<ExportRow>(CHESS_PUZZLES_LOAD_EXPORT_SQL)
    );
    // §23: only rows that pass the validation pass reach the load file.
    const tally = new PuzzleIngestTally();
    const rows = stored.flatMap((row) => {
      const tableRow = tally.accept(row);
      return tableRow === null ? [] : [tableRow];
    });
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rowsToCsv(rows), 'utf8');
    log.info('export:puzzles-load wrote load file', {
      outPath,
      rowCount: rows.length,
      skipped: tally.skipped(),
      secretsEnv: env.env,
    });
    return { outPath, rowCount: rows.length };
  } finally {
    await sqlClient.disconnect();
  }
}
