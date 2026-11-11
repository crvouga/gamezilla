// @io-wall-ok — writes and reads failure records in the package's report bucket.
/**
 * Failed objectives and firing policies, one JSON file each under
 * `<reportDir>/failures/`, keyed like the evidence (objective file, then
 * check), so a rerun of a check replaces its earlier record.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { evidenceKey, sha256 } from '@pkgs/conformance-shared-ts/evidence';
import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import { failureId, isObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';

function failuresDir(reportDir: string): string {
  return join(reportDir, 'failures');
}

export function writeFailure(
  reportDir: string,
  failure: ObjectiveFailure
): void {
  const dir = failuresDir(reportDir);
  mkdirSync(dir, { recursive: true });
  const name = `${evidenceKey(failure.specUri)}.${sha256(failureId(failure)).slice(0, 16)}.json`;
  writeFileSync(join(dir, name), `${JSON.stringify(failure, null, 2)}\n`);
}

/** Every well-formed failure record in `reportDir`, in file-name order. */
export function readFailures(reportDir: string): readonly ObjectiveFailure[] {
  const dir = failuresDir(reportDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      return isObjectiveFailure(parsed) ? [parsed] : [];
    });
}
