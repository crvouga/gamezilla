import { expect, test } from 'bun:test';
import { chooseActivity } from '@libs/population-shared/decision-policy';
import { replayDecision } from '@libs/population-shared/decision-replay';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';
import fc from 'fast-check';

test('recorded policy inputs reproduce decisions without depending on external timing', () => {
  assertProperty(
    'recorded population decision replay',
    fc.property(fc.integer(), (seed) => {
      const random = createHarnessIds(seed).random;
      const inputs = {
        hasActiveMatch: false,
        hasQueueEntry: false,
        availableSpaces: ['space-card-cedar', 'space-card-oak'],
        paused: false,
        draining: false,
        sessionElapsedMs: 1000,
        sessionLimitMs: 60_000,
        hostingWeight: 0.3,
      };
      const draws: number[] = [];
      const selected = chooseActivity(inputs, () => {
        const draw = random();
        draws.push(draw);
        return draw;
      });
      expect(replayDecision({ ...inputs, draws, selected })).toEqual({
        selected,
        matches: true,
      });
      expect(
        replayDecision({
          ...inputs,
          draws,
          selected: { activity: 'impossible', targetControlId: null },
        })?.matches
      ).toBe(false);
    })
  );
  expect(replayDecision(null)).toBeNull();
  expect(replayDecision({ draws: [1] })).toBeNull();
});
