// @io-wall-ok — schema contract CLI entry root (scripts/**).
import { assertEvolvable } from '@pkgs/db-schema';
import { appSchema } from '../src/root/app-schema';
import { readBaselineSnapshot, readSnapshotFile } from './schema-snapshot-file';

function main(): void {
  const committed = readSnapshotFile();
  if (committed === null) {
    throw new Error(
      'schema-snapshot.json is missing — run: bun run --filter @libs/runtime schema:snapshot'
    );
  }
  const current = appSchema.snapshot();
  if (JSON.stringify(committed.snapshot) !== JSON.stringify(current)) {
    throw new Error(
      'appSchema changed but schema-snapshot.json was not regenerated — run: bun run --filter @libs/runtime schema:snapshot'
    );
  }
  const baseline = readBaselineSnapshot() ?? committed;
  const warnings = assertEvolvable(baseline.snapshot, current);
  for (const warning of warnings) {
    console.warn(`warning ${warning.path}: ${warning.message}`);
  }
  console.log(`schema contract release ${String(committed.release)} is valid`);
}

main();
