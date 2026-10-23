// @io-wall-ok — schema contract CLI entry root (scripts/**).
import { writeFileSync } from 'node:fs';
import { appSchema } from '@libs/runtime-shared-ts/app-schema';
import { assertEvolvable } from '@pkgs/db-schema-root-shared-ts/schema-evolution';
import {
  readSnapshotFile,
  SNAPSHOT_PATH,
  serializeSnapshotFile,
} from './schema-snapshot-file';

function main(): void {
  const previous = readSnapshotFile();
  const snapshot = appSchema.snapshot();
  if (previous !== null) {
    // Regeneration must not launder an unsafe change.
    const warnings = assertEvolvable(previous.snapshot, snapshot);
    for (const warning of warnings) {
      console.warn(`warning ${warning.path}: ${warning.message}`);
    }
  }
  if (
    previous !== null &&
    JSON.stringify(previous.snapshot) === JSON.stringify(snapshot)
  ) {
    console.log(
      `schema snapshot release ${String(previous.release)} unchanged`
    );
    return;
  }
  const release = (previous?.release ?? 0) + 1;
  writeFileSync(
    SNAPSHOT_PATH,
    serializeSnapshotFile({ release, snapshot }),
    'utf8'
  );
  console.log(`schema snapshot release ${String(release)} written`);
}

main();
