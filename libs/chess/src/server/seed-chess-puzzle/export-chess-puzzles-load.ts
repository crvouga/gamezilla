/**
 * Export a bounded chess_puzzles CSV load file from Postgres (typically prod).
 *
 *   SECRETS_ENV=prd bun run tools/scripts/secrets-run.ts -- \
 *     bun run --filter @libs/chess export:puzzles-load -- --confirm-prod
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import {
  assertDevSecretsEnv,
  PRODUCTION_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assertDatabaseUrlAllowedForSecretsEnvForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { assert } from '@pkgs/assert';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { raw } from '@pkgs/sql';
import { openPgClient } from '@pkgs/sql-client/postgres/connect';
import {
  CHESS_PUZZLES_LOAD_CSV_COLUMNS,
  CHESS_PUZZLES_LOAD_EXPORT_SQL,
  resolveChessPuzzlesLoadFilePath,
} from './load-file';

const io = wallIo();
const REPO_ROOT = join(import.meta.dirname, '../../../../..');

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

function rowsToCsv(rows: readonly ExportRow[]): string {
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
    now: io.clock.now,
  });
  const store = createScriptSecretStore();
  const secretsEnv =
    process.env['SECRETS_ENV']?.trim() || resolveSecretsScope(REPO_ROOT).env;
  if (secretsEnv === PRODUCTION_SECRETS_ENV && !confirmProd) {
    assert.fail(
      'export:puzzles-load: refusing SECRETS_ENV=prd without --confirm-prod'
    );
  }
  if (secretsEnv !== PRODUCTION_SECRETS_ENV) {
    assertDevSecretsEnv(secretsEnv);
  }
  const databaseUrl = (
    await store.getRequired('DATABASE_URL')
  ).readSecretValue();
  await assertDatabaseUrlAllowedForSecretsEnvForTooling(
    databaseUrl,
    secretsEnv,
    { surface: 'chess:export-puzzles-load' }
  );

  const outPath = resolveChessPuzzlesLoadFilePath();
  const { sqlClient } = await openPgClient({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
    clientOptions: { application_name: 'export:puzzles-load' },
  });
  try {
    const rows = await sqlClient.query(
      raw<ExportRow>(CHESS_PUZZLES_LOAD_EXPORT_SQL)
    );
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rowsToCsv(rows), 'utf8');
    log.info('export:puzzles-load wrote load file', {
      outPath,
      rowCount: rows.length,
      secretsEnv,
    });
    return { outPath, rowCount: rows.length };
  } finally {
    await sqlClient.disconnect();
  }
}
