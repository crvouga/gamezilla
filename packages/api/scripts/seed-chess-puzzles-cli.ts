/**
 * CLI parsing for the chess-puzzle seed. Split out from the main script
 * so the orchestrator file stays under the project line / complexity caps.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(SCRIPT_DIR, '..');

export const DEFAULT_PUZZLE_URL =
  'https://database.lichess.org/lichess_db_puzzle.csv.zst';
export const DEFAULT_CACHE_DIR = join(API_ROOT, '.cache', 'lichess');

export const DEFAULT_BATCH_SIZE = 1000;
export const DEFAULT_PACE_MS = 250;
export const DEFAULT_CHECKPOINT_EVERY = 25;
export const DEFAULT_PROGRESS_EVERY = 10;

export type Cli = {
  source: string;
  cacheDir: string;
  batchSize: number;
  limit: number | null;
  noResume: boolean;
  dryRun: boolean;
  /** Sleep after each batch flush (ms) so autovacuum / WAL writer keep up. */
  paceMs: number;
  /** Issue `CHECKPOINT` + lightweight `VACUUM ANALYZE` every N batches. */
  checkpointEvery: number;
  /** Persist the resume cursor every N batches instead of every batch. */
  progressEvery: number;
  /** After the seed completes, REINDEX `pdb_idx_chess_puzzle__*` concurrently. */
  rebuildIndexes: boolean;
  /** Colored stderr progress + concise phases (vs JSON lines). */
  prettyOutput: boolean;
};

function parsePositiveIntFlag(
  raw: unknown,
  flag: string,
  defaultValue: number
): number {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return defaultValue;
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid ${flag}: ${String(raw)} (must be >= 1)`);
  }
  return n;
}

function parseNonNegativeIntFlag(
  raw: unknown,
  flag: string,
  defaultValue: number
): number {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return defaultValue;
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${flag}: ${String(raw)} (must be >= 0)`);
  }
  return n;
}

function parseLimitFlag(raw: unknown): number | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return null;
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid --limit: ${String(raw)}`);
  }
  return n;
}

function resolvePrettyOutput(values: Record<string, unknown>): boolean {
  if (values['json'] === true) return false;
  if (values['no-pretty'] === true) return false;
  if (values['pretty'] === true) return true;
  const stderr = process.stderr as NodeJS.WriteStream & { isTTY?: boolean };
  return (
    stderr.isTTY === true &&
    process.env['CI'] !== 'true' &&
    process.env['CI'] !== '1'
  );
}

function readStringFlag(value: unknown, fallback: string): string {
  return (typeof value === 'string' ? value.trim() : '') || fallback;
}

export function parseCli(argv: string[]): Cli {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string' },
      'cache-dir': { type: 'string' },
      'batch-size': { type: 'string' },
      limit: { type: 'string' },
      'pace-ms': { type: 'string' },
      'checkpoint-every': { type: 'string' },
      'progress-every': { type: 'string' },
      'rebuild-indexes': { type: 'boolean', default: false },
      'no-resume': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      pretty: { type: 'boolean', default: false },
      'no-pretty': { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: false,
  });

  return {
    source: readStringFlag(values.source, DEFAULT_PUZZLE_URL),
    cacheDir: readStringFlag(values['cache-dir'], DEFAULT_CACHE_DIR),
    batchSize: parsePositiveIntFlag(
      values['batch-size'],
      '--batch-size',
      DEFAULT_BATCH_SIZE
    ),
    limit: parseLimitFlag(values.limit),
    noResume: values['no-resume'] === true,
    dryRun: values['dry-run'] === true,
    paceMs: parseNonNegativeIntFlag(
      values['pace-ms'],
      '--pace-ms',
      DEFAULT_PACE_MS
    ),
    checkpointEvery: parsePositiveIntFlag(
      values['checkpoint-every'],
      '--checkpoint-every',
      DEFAULT_CHECKPOINT_EVERY
    ),
    progressEvery: parsePositiveIntFlag(
      values['progress-every'],
      '--progress-every',
      DEFAULT_PROGRESS_EVERY
    ),
    rebuildIndexes: values['rebuild-indexes'] === true,
    prettyOutput: resolvePrettyOutput(values as Record<string, unknown>),
  };
}
