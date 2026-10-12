// @io-wall-ok — writes the seeds a randomized run drew, so a failure replays.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RECORD_DIR = join(import.meta.dirname, '../.cache/randomized');

/**
 * `apps/product/.cache/randomized/<name>.json`: the seeds of the latest
 * randomized run and what failed under them. Rewritten as the run goes, so a
 * killed run still leaves the seeds it had drawn.
 */
export function recordSeeds(name: string, record: unknown): void {
  const path = join(RECORD_DIR, `${name}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}
