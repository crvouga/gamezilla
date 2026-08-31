import type { QueryRow } from '../queries/core/types';
import { fanoutRowsWithinCap } from '../shared/select-fanout-rows';

/** Drop row images that exceed protocol fanout caps (Byzantine / lossy path). */
export function rowsWithinReceiveCap(
  rows: Readonly<Record<string, readonly QueryRow[]>> | undefined
): Readonly<Record<string, readonly QueryRow[]>> | undefined {
  if (rows === undefined) return undefined;
  if (fanoutRowsWithinCap(rows)) return rows;
  return undefined;
}
