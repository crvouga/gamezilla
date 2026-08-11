import { describe, test } from 'bun:test';
import {
  ActBeforeDeadline,
  DeadlineFixtureModule,
  deadlineOutcome,
  deadlineStatus,
  ExpireDeadline,
  StartDeadline,
} from '../fixtures/deadline-module';
import { runModuleConformance } from './run-module-conformance';

describe('kit: engine fuzz sequences (M-F08)', () => {
  test('DeadlineFixtureModule fuzz converges', async () => {
    await runModuleConformance({
      seed: process.env['SIM_SEED'] ?? '42',
      module: DeadlineFixtureModule,
      fuzzSteps: 30,
      isValidState: (s) => {
        const st = deadlineStatus(s);
        return (
          st === 'idle' || st === 'open' || st === 'won' || st === 'expired'
        );
      },
      isTerminal: (s) => {
        const o = deadlineOutcome(s);
        return o === 'won' || o === 'expired';
      },
      outcomeId: (s) => deadlineOutcome(s),
      generateCommand: ({ rng, state, step }) => {
        const st = deadlineStatus(state);
        if (st === 'idle') return StartDeadline({ durationMs: 40 + step });
        if (st === 'open') {
          return rng.bool(0.5) ? ActBeforeDeadline({}) : ExpireDeadline({});
        }
        return null;
      },
    });
  });
});
