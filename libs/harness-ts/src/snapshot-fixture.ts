import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';
import { parseHarnessSystemSnapshotJson } from '@pkgs/harness-console-shared-ts/system-snapshot-schema';

/** Committed snapshots live with the package whose tests restore them. */
const FIXTURES_DIR = join(process.cwd(), 'fixtures/snapshots');

export function resolveHarnessSnapshotPath(id: string): string {
  const safe = id.trim();
  if (safe.length === 0 || /[\\/]/.test(safe) || safe.includes('..')) {
    throw new Error(`resolveHarnessSnapshotPath: invalid snapshot id '${id}'`);
  }
  return join(FIXTURES_DIR, `${safe}.json`);
}

export function readHarnessSystemSnapshot(id: string): HarnessSystemSnapshot {
  const path = resolveHarnessSnapshotPath(id);
  const text = readFileSync(path, 'utf8');
  return parseHarnessSystemSnapshotJson(text);
}

export function writeHarnessSystemSnapshot(
  id: string,
  snapshot: HarnessSystemSnapshot
): void {
  const path = resolveHarnessSnapshotPath(id);
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}
