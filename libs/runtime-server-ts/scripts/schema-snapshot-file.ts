// @io-wall-ok — schema contract CLI entry root (scripts/**).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Snapshot } from '@pkgs/db-schema-root-shared-ts/types';

export type SchemaSnapshotFile = {
  readonly release: number;
  readonly snapshot: Snapshot;
};

/** Working-tree contract artifact. */
export const SNAPSHOT_PATH = resolve(
  import.meta.dir,
  '..',
  'schema-snapshot.json'
);

/** Repo-relative path of the contract artifact (for `git show`). */
export const SNAPSHOT_REPO_PATH = 'libs/runtime-server-ts/schema-snapshot.json';

export function readSnapshotFile(
  path = SNAPSHOT_PATH
): SchemaSnapshotFile | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as SchemaSnapshotFile;
}

export function serializeSnapshotFile(file: SchemaSnapshotFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * The contract as committed on the comparison ref. This is the baseline the
 * evolution rules are applied to, so a hand-edited artifact cannot launder an
 * unsafe change.
 */
export function readBaselineSnapshot(
  ref = process.env['PR_BASE'] || 'origin/main'
): SchemaSnapshotFile | null {
  const result = Bun.spawnSync(
    ['git', 'show', `${ref}:${SNAPSHOT_REPO_PATH}`],
    { stdout: 'pipe', stderr: 'ignore' }
  );
  if (result.exitCode !== 0) return null;
  try {
    return JSON.parse(result.stdout.toString()) as SchemaSnapshotFile;
  } catch {
    return null;
  }
}
