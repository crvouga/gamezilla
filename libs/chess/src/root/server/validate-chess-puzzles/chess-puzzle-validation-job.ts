/**
 * §35 full-database validation job: every puzzle's line is legal and ends on
 * the solver's move (plus the rest of the §23 pass and position dedupe).
 *
 *   bun run --filter @libs/chess validate:puzzles                  # DATABASE_URL
 *   bun run --filter @libs/chess validate:puzzles -- --source a.csv --source b.csv
 *   bun run --filter @libs/chess validate:puzzles -- --source https://database.lichess.org/lichess_db_puzzle.csv.zst
 *
 * `--db` validates the live `chess_puzzles` table (the default when no
 * `--source` is given). The script exits non-zero when any row is invalid.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { Logger } from '@pkgs/logger';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { openPgClient } from '@pkgs/sql-client-postgres/connect';

import { DEFAULT_CACHE_DIR } from '../seed-chess-puzzles/cli';
import { PuzzleArchiveCache } from '../seed-chess-puzzles/streaming';
import { resolveToolingDatabaseUrl } from '../seed-chess-puzzles/tooling-database-url';
import {
  PuzzleValidationReport,
  type PuzzleValidationSummary,
} from './puzzle-validation-report';
import {
  validatePuzzleArchive,
  validatePuzzleTable,
} from './puzzle-validation-sources';

const REPO_ROOT = join(import.meta.dirname, '../../../../..');

export type PuzzleValidationCli = {
  readonly sources: readonly string[];
  readonly database: boolean;
  readonly cacheDir: string;
};

export function parsePuzzleValidationCli(
  argv: readonly string[]
): PuzzleValidationCli {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      source: { type: 'string', multiple: true },
      db: { type: 'boolean', default: false },
      'cache-dir': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const sources = values.source ?? [];
  return {
    sources,
    database: values.db === true || sources.length === 0,
    cacheDir: values['cache-dir'] ?? DEFAULT_CACHE_DIR,
  };
}

export type ChessPuzzleValidationJobPorts = {
  readonly clock: Clock;
  readonly http: HttpClient;
  readonly log: Logger;
};

export type ChessPuzzleValidationJobStores = {
  readonly configStore: ObjectStore;
  readonly sourceStore: ObjectStore;
  readonly cacheStoreForDir: (cacheDir: string) => ObjectStore;
};

export class ChessPuzzleValidationJob {
  readonly #cli: PuzzleValidationCli;
  readonly #ports: ChessPuzzleValidationJobPorts;
  readonly #stores: ChessPuzzleValidationJobStores;

  constructor(
    cli: PuzzleValidationCli,
    ports: ChessPuzzleValidationJobPorts,
    stores: ChessPuzzleValidationJobStores
  ) {
    this.#cli = cli;
    this.#ports = ports;
    this.#stores = stores;
  }

  async run(): Promise<PuzzleValidationSummary> {
    const log = this.#ports.log;
    const report = new PuzzleValidationReport();
    const archives = new PuzzleArchiveCache({
      log,
      http: this.#ports.http,
      now: this.#ports.clock.now,
      cacheStore: this.#stores.cacheStoreForDir(this.#cli.cacheDir),
      sourceStore: this.#stores.sourceStore,
    });
    for (const source of this.#cli.sources) {
      const resolved = await archives.ensureCachedArchive({
        source,
        cacheDir: this.#cli.cacheDir,
      });
      await validatePuzzleArchive(resolved, report);
    }
    if (this.#cli.database) await this.#validateDatabase(report);
    const summary = report.summary();
    log.info('validate:puzzles: done', { ...summary });
    return summary;
  }

  async #validateDatabase(report: PuzzleValidationReport): Promise<void> {
    const { databaseUrl } = await resolveToolingDatabaseUrl({
      configStore: this.#stores.configStore,
      http: this.#ports.http,
      repoRoot: REPO_ROOT,
      surface: 'chess:validate-puzzles',
    });
    const { sqlClient } = await openPgClient({
      connectionString: databaseUrl,
      dbScope: createPostgresDbScope('public'),
      clientOptions: { application_name: 'validate:puzzles' },
    });
    try {
      await validatePuzzleTable(sqlClient, report);
    } finally {
      await sqlClient.disconnect();
    }
  }
}
