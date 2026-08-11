import { describe, expect, test } from 'bun:test';
import {
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { runModuleConformance } from './run-module-conformance';

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
