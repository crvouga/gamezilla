import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import { parseSimSystemSnapshotJson } from '@pkgs/sim-console/shared/sim-system-snapshot-schema';

const FIXTURES_DIR = join(__dirname, '../../fixtures/snapshots');

export function resolveSimSnapshotPath(id: string): string {
  const safe = id.trim();
  if (safe.length === 0 || safe.includes('/') || safe.includes('..')) {
    throw new Error(`resolveSimSnapshotPath: invalid snapshot id '${id}'`);
  }
  return join(FIXTURES_DIR, `${safe}.json`);
}

export function readSimSystemSnapshot(id: string): SimSystemSnapshot {
  const path = resolveSimSnapshotPath(id);
  const text = readFileSync(path, 'utf8');
  return parseSimSystemSnapshotJson(text);
}

export function writeSimSystemSnapshot(
  id: string,
  snapshot: SimSystemSnapshot
): void {
  const path = resolveSimSnapshotPath(id);
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}
