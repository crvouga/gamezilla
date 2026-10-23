/**
 * CLI parsing for the chess-puzzle seed. Split out from the main script
 * so the orchestrator file stays under the project line / complexity caps.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** `@libs/chess` package root (`libs/chess`). */
const CHESS_PACKAGE_ROOT = resolve(
  SCRIPT_DIR,
  '../../chess-puzzle-client-ts/src'
);

export const DEFAULT_PUZZLE_URL =
  'https://database.lichess.org/lichess_db_puzzle.csv.zst';
export const DEFAULT_CACHE_DIR = join(CHESS_PACKAGE_ROOT, '.cache', 'lichess');

export const DEFAULT_BATCH_SIZE = 2000;
export const DEFAULT_PACE_MS = 0;
export const DEFAULT_CHECKPOINT_EVERY = 0;
export const DEFAULT_PROGRESS_EVERY = 50;
/** Drop chess-puzzle snapshot secondary indexes before bulk insert. */
export const DEFAULT_DEFER_INDEXES = true;

export type ProfileName = 'auto' | 'fast' | 'managed';

export type Cli = {
  source: string;
  cacheDir: string;
  profile: ProfileName;
  batchSize: number;
  limit: number | null;
  noResume: boolean;
  dryRun: boolean;
  /** Sleep after each batch flush (ms) so autovacuum / WAL writer keep up. */
  paceMs: number;
  /** Issue `CHECKPOINT` + lightweight `VACUUM ANALYZE` every N batches (0 = off). */
  checkpointEvery: number;
  /** Persist the resume cursor every N batches instead of every batch. */
  progressEvery: number;
  /** After the seed completes, REINDEX `pdb_idx_chess_puzzle__*` concurrently. */
  rebuildIndexes: boolean;
  /** Drop chess-puzzle snapshot secondary indexes before bulk insert. */
  deferIndexes: boolean;
  /** Colored stderr progress + concise phases (vs JSON lines). */
  prettyOutput: boolean;
  /** Flags explicitly passed on the command line (for profile merge). */
  explicitTuning: ReadonlySet<string>;
};

const TUNING_FLAGS = [
  '--batch-size',
  '--pace-ms',
  '--checkpoint-every',
  '--progress-every',
  '--rebuild-indexes',
  '--defer-indexes',
  '--no-defer-indexes',
] as const;

function collectExplicitTuning(argv: string[]): ReadonlySet<string> {
  const explicit = new Set<string>();
  for (const arg of argv) {
    for (const flag of TUNING_FLAGS) {
      if (arg === flag || arg.startsWith(`${flag}=`)) {
        explicit.add(flag);
      }
    }
  }
  return explicit;
}

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

function parseProfileFlag(raw: unknown): ProfileName {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '' || text === 'auto') return 'auto';
  if (text === 'fast' || text === 'managed') return text;
  throw new Error(
    `Invalid --profile: ${String(raw)} (must be auto, fast, or managed)`
  );
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
      profile: { type: 'string' },
      'batch-size': { type: 'string' },
      limit: { type: 'string' },
      'pace-ms': { type: 'string' },
      'checkpoint-every': { type: 'string' },
      'progress-every': { type: 'string' },
      'rebuild-indexes': { type: 'boolean', default: false },
      'defer-indexes': { type: 'boolean', default: false },
      'no-defer-indexes': { type: 'boolean', default: false },
      'no-resume': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      pretty: { type: 'boolean', default: false },
      'no-pretty': { type: 'boolean', default: false },
    },
    strict: false,
    allowPositionals: false,
  });

  const explicitTuning = collectExplicitTuning(argv);
  const deferIndexes =
    values['no-defer-indexes'] === true
      ? false
      : values['defer-indexes'] === true
        ? true
        : DEFAULT_DEFER_INDEXES;

  return {
    source: readStringFlag(values.source, DEFAULT_PUZZLE_URL),
    cacheDir: readStringFlag(values['cache-dir'], DEFAULT_CACHE_DIR),
    profile: parseProfileFlag(values.profile),
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
    checkpointEvery: parseNonNegativeIntFlag(
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
    deferIndexes,
    prettyOutput: resolvePrettyOutput(values as Record<string, unknown>),
    explicitTuning,
  };
}
