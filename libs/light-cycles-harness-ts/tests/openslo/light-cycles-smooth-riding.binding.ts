/**
 * `specs/light-cycles/light-cycles-smooth-riding.openslo.yaml`: a duel
 * ridden through the production replica, presentation and room on virtual
 * time, on each device profile and seed, judged step by step as a 60 Hz
 * display shows it (`light-cycles-frame-probe`).
 */

import {
  lightCyclesFrameSystem,
  measureLightCyclesFrames,
} from '@libs/light-cycles-harness-ts/light-cycles-frame-probe';
import {
  LIGHT_CYCLES_FRAME_PROFILES,
  LIGHT_CYCLES_FRAME_SEEDS,
} from '@libs/light-cycles-harness-ts/light-cycles-frame-profiles';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';

async function pace(): Promise<Measurement> {
  const samples: { atMs: number; value: number }[] = [];
  for (const args of Object.values(LIGHT_CYCLES_FRAME_PROFILES))
    for (const seed of LIGHT_CYCLES_FRAME_SEEDS) {
      await using run = await lightCyclesFrameSystem.run({ seed, args });
      const report = await run.read(measureLightCyclesFrames);
      if (report.errors > 0)
        throw new Error(
          `Light Cycles presentation failed ${report.errors} times`
        );
      // The probe judges in milliseconds; the objective says seconds.
      for (const one of report.evidence)
        samples.push({ atMs: one.atMs, value: one.value / 1000 });
    }
  return { kind: 'samples', samples };
}

bindObjectives({
  spec: 'light-cycles-smooth-riding',
  timeoutMs: 120_000,
  measure: { 'light-cycles-rider-pace': pace },
});
