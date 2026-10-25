import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  lightCyclesRecording,
  lightCyclesStep,
  observeLightCyclesRecording,
  verifyLightCyclesRecording,
} from './light-cycles-network-checks';

const seed = fc.integer({ min: 1, max: 1_000_000 });
const steps = fc.array(lightCyclesStep, { minLength: 4, maxLength: 32 });

test('a Quad arena over real rooms keeps its rules through seeded faults, and every device converges', async () => {
  await assertProperty(
    'Light Cycles Quad adverse network',
    fc.asyncProperty(seed, steps, (runSeed, scenario) =>
      verifyLightCyclesRecording(lightCyclesRecording(runSeed, scenario))
    )
  );
}, 120_000);

test('a recorded scenario replays to the same publications, inputs and refusals', async () => {
  await assertProperty(
    'Light Cycles Quad replay determinism',
    fc.asyncProperty(seed, steps, async (runSeed, scenario) => {
      const recording = lightCyclesRecording(runSeed, scenario);
      const first = await observeLightCyclesRecording(recording);
      const second = await observeLightCyclesRecording(recording);
      expect(second.timeline).toEqual(first.timeline);
      expect(second.outcome).toEqual(first.outcome);
    }),
    { numRuns: 8 }
  );
}, 60_000);
