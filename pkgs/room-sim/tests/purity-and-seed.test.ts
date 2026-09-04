import { describe, expect, test } from 'bun:test';
import {
  Decrement,
  Increment,
  runModuleConformance,
  TestCounterModule,
} from '@pkgs/room-sim';

describe('kit: purity and seed (M-F01)', () => {
  test('TestCounterModule passes conformance smoke', async () => {
    await runModuleConformance({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
      mildFaults: false,
      isValidState: () => true,
      generateCommand: ({ rng }) =>
        rng.bool(0.5) ? Increment({}) : Decrement({}),
    });
    expect(true).toBe(true);
  });
});
