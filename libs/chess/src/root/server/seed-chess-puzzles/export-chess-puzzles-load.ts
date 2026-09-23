// @io-wall-ok
/**
 * Export a bounded chess_puzzles CSV load file from Postgres (typically prod).
 *
 *   SECRETS_ENV=prd bun run libs/secrets/src/scripts/secrets-run.ts -- \
 *     bun run --filter @libs/chess export:puzzles-load -- --confirm-prod
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import { PRODUCTION_SECRETS_ENV } from '@pkgs/database-url-policy';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { raw } from '@pkgs/sql';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { openPgClient } from '@pkgs/sql-client-postgres/connect';
import {
  CHESS_PUZZLES_LOAD_CSV_COLUMNS,
  CHESS_PUZZLES_LOAD_EXPORT_SQL,
  resolveChessPuzzlesLoadFilePath,
} from './load-file';
import { PuzzleIngestTally } from './puzzle-ingest';
import type { PuzzleTableRow } from './row';
import { resolveToolingDatabaseUrl } from './tooling-database-url';

const REPO_ROOT = join(import.meta.dirname, '../../../../..');
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

function rowsToCsv(rows: readonly PuzzleTableRow[]): string {
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
  const { databaseUrl, secretsEnv } = await resolveToolingDatabaseUrl({
    configStore,
    http: createGlobalHttpClient(),
    repoRoot: REPO_ROOT,
    surface: 'chess:export-puzzles-load',
    guardSecretsEnv: (env) => {
      if (env === PRODUCTION_SECRETS_ENV && !confirmProd) {
        assert.fail(
          'export:puzzles-load: refusing SECRETS_ENV=prd without --confirm-prod'
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
      secretsEnv,
    });
    return { outPath, rowCount: rows.length };
  } finally {
    await sqlClient.disconnect();
  }
}
