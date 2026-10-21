/**
 * `specs/sync-engine/note-delivery.openslo.yaml`, measured on the example
 * app: every note's time to reach each other person's device in one
 * deterministic run (see `note-arrivals.ts`), on the run's virtual clock.
 *
 * The run's clock starts wherever the harness starts it, so the samples are
 * placed in the objective's window by their distance from the run's end:
 * the run ends at the evaluation moment, a pinned instant.
 */

import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import type { MeasureContext } from '@pkgs/openslo-shared-ts/registry';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { noteArrivals } from './note-arrivals';

/** Monday 2026-09-28 12:00 UTC: when the objective is evaluated. */
const EVALUATED_AT_MS = Date.UTC(2026, 8, 28, 12);
const SEED = 1;

async function noteArrivalTime(context: MeasureContext): Promise<Measurement> {
  const { arrivals, endMs } = await noteArrivals(() =>
    exampleSystem.run({ seed: SEED, args: { clientCount: 0 } })
  );
  return {
    kind: 'samples',
    samples: arrivals.map((arrival) => ({
      atMs: context.endMs - (endMs - arrival.writtenAtMs),
      value: arrival.tookMs,
    })),
  };
}

bindObjectives({
  spec: 'note-delivery',
  measure: { 'note-arrival-time': noteArrivalTime },
  nowMs: () => EVALUATED_AT_MS,
});
