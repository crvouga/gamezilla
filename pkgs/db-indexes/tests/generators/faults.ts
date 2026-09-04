import fc from 'fast-check';
import type { SimFault } from '../../sim/sim-db';

export type FaultScheduleItem = {
  readonly kind:
    | SimFault['kind']
    | 'external_add_non_owned'
    | 'external_add_owned_named'
    | 'bump_usage';
  readonly onCall: number;
  readonly latencyMs?: number;
};

/**
 * Per-call fault schedule for DST.
 */
export const genFaultSchedule: fc.Arbitrary<readonly FaultScheduleItem[]> = fc
  .array(
    fc.record({
      kind: fc.constantFrom(
        'none',
        'transient',
        'lock_timeout',
        'crash_inside',
        'latency',
        'external_add_non_owned',
        'external_add_owned_named',
        'bump_usage'
      ) as fc.Arbitrary<FaultScheduleItem['kind']>,
      onCall: fc.integer({ min: 1, max: 30 }),
      latencyMs: fc.constantFrom(0, 5, 50),
    }),
    { minLength: 0, maxLength: 8 }
  )
  .map((items) =>
    items.map((i) => ({
      kind: i.kind,
      onCall: i.onCall,
      ...(i.kind === 'latency' ? { latencyMs: i.latencyMs } : {}),
    }))
  );

export function toSimFaults(
  schedule: readonly FaultScheduleItem[]
): SimFault[] {
  const out: SimFault[] = [];
  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i]!;
    if (
      s.kind === 'external_add_non_owned' ||
      s.kind === 'external_add_owned_named' ||
      s.kind === 'bump_usage'
    ) {
      continue;
    }
    out.push({ kind: s.kind, onCall: s.onCall });
  }
  return out;
}
