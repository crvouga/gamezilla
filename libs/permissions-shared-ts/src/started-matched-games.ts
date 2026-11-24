/**
 * The matched games a case's person already started, as the instants they
 * started, placed on the day boundary itself: "started today" at exactly UTC
 * midnight of the case's day (the first instant that counts), "started
 * before today" one millisecond earlier (the last instant that does not).
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { CaseInput } from './people';
import { countInput, DMN_INPUT } from './people';
import { utcMidnightOf } from './puzzle-ledger';

/** When each of the case's matched games started, as stored (ISO). */
export function startedMatchedGameTimes(
  input: CaseInput,
  nowMs: number
): readonly string[] {
  const midnight = utcMidnightOf(nowMs);
  const at = (ms: number) => new Date(ms).toISOString();
  return [
    ...Array.from({ length: countInput(input, DMN_INPUT.matchedToday) }, () =>
      at(midnight)
    ),
    ...Array.from({ length: countInput(input, DMN_INPUT.matchedEarlier) }, () =>
      at(midnight - 1)
    ),
  ];
}
