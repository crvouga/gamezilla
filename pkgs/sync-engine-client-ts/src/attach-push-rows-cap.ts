import { fanoutRowsWithinCap } from '@pkgs/sync-engine-shared-ts/select-fanout-rows';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

/** Drop row images that exceed protocol fanout caps (Byzantine / lossy path). */
export function rowsWithinReceiveCap(
  rows: Readonly<Record<string, readonly QueryRow[]>> | undefined
): Readonly<Record<string, readonly QueryRow[]>> | undefined {
  if (rows === undefined) return undefined;
  if (fanoutRowsWithinCap(rows)) return rows;
  return undefined;
}
