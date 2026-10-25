import { expect, test } from 'bun:test';
import { InputPrediction } from '@libs/game-session-shared-ts/simulation-prediction';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const initial = { epoch: 'race:1', tick: 0, acknowledged: 0, state: 0 };

test('projection history requires the exact epoch, input sequence and logical tick', () => {
  const prediction = new InputPrediction(
    initial,
    (state, input: { value: number }) => state + input.value,
    2
  );
  prediction.submit(3, 2);
  prediction.submit(4, 3);
  expect(
    prediction.projectedStateAt({ ...initial, tick: 2, acknowledged: 1 })
  ).toBe(3);
  for (const snapshot of [
    { ...initial, epoch: 'race:0', tick: 2, acknowledged: 1 },
    { ...initial, tick: 3, acknowledged: 1 },
    { ...initial, tick: 2, acknowledged: 2 },
    { ...initial, tick: 2, acknowledged: 3 },
  ])
    expect(prediction.projectedStateAt(snapshot)).toBeNull();
  prediction.reconcile({ ...initial, tick: 2, acknowledged: 1, state: 2 });
  expect(
    prediction.projectedStateAt({ ...initial, tick: 2, acknowledged: 1 })
  ).toBeNull();
  expect(
    prediction.projectedStateAt({ ...initial, tick: 3, acknowledged: 2 })
  ).toBe(6);
  prediction.reset({ ...initial, epoch: 'race:2' });
  expect(
    prediction.projectedStateAt({ ...initial, tick: 3, acknowledged: 2 })
  ).toBeNull();
});

test('clock checkpoint partitions cannot repeat already elapsed predicted motion', () => {
  assertProperty(
    'prediction rebase logical time partition invariance',
    fc.property(
      fc.integer({ min: 2, max: 100 }),
      fc.array(fc.integer({ min: 1, max: 99 }), { maxLength: 20 }),
      fc.integer({ min: -20, max: 20 }),
      (tick, parts, velocity) => {
        const prediction = new InputPrediction(
          initial,
          (state, input: { tick: number; value: number }, fromTick) =>
            state + (input.tick - fromTick) * input.value,
          1
        );
        prediction.submit(velocity, tick);
        const checkpoints = [
          ...new Set(parts.map((part) => 1 + (part % (tick - 1)))),
        ].sort((a, b) => a - b);
        for (const checkpoint of checkpoints) {
          expect(
            prediction.reconcile({
              ...initial,
              tick: checkpoint,
              state: checkpoint * velocity,
            })
          ).toBe(true);
          expect(prediction.state()).toBe(tick * velocity);
          expect(
            prediction.projectedStateAt({ ...initial, tick, acknowledged: 1 })
          ).toBe(tick * velocity);
        }
        prediction.reconcile({
          ...initial,
          tick,
          acknowledged: 1,
          state: tick * velocity,
        });
        expect(
          prediction.projectedStateAt({ ...initial, tick, acknowledged: 1 })
        ).toBeNull();
      }
    )
  );
});

test('projection retention follows the pending-input bound and expires unacknowledged old ticks', () => {
  assertProperty(
    'prediction projection retention bound',
    fc.property(fc.integer({ min: 1, max: 64 }), (capacity) => {
      const prediction = new InputPrediction(
        initial,
        (state, input: { value: number }) => state + input.value,
        capacity
      );
      for (let sequence = 1; sequence <= capacity; sequence++) {
        expect(prediction.submit(1, sequence * 2)?.sequence).toBe(sequence);
        expect(
          prediction.projectedStateAt({
            ...initial,
            tick: sequence * 2,
            acknowledged: sequence,
          })
        ).toBe(sequence);
      }
      expect(prediction.submit(1, capacity * 2 + 1)).toBeNull();
      prediction.reconcile({ ...initial, tick: capacity * 2 + 1 });
      expect(prediction.pendingCount()).toBe(0);
      for (let sequence = 1; sequence <= capacity; sequence++)
        expect(
          prediction.projectedStateAt({
            ...initial,
            tick: sequence * 2,
            acknowledged: sequence,
          })
        ).toBeNull();
      expect(prediction.submit(1, capacity * 2 + 2)).not.toBeNull();
    })
  );
});
