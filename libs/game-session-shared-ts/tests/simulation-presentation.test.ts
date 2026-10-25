import { expect, test } from 'bun:test';
import { SnapshotInterpolation } from '@libs/game-session-shared-ts/simulation-interpolation';
import { InputPrediction } from '@libs/game-session-shared-ts/simulation-prediction';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const initial = {
  epoch: 'race-round-1',
  tick: 0,
  acknowledged: 0,
  state: { local: 0, remote: 10, score: 0 },
};
const prediction = (capacity = 4) =>
  new InputPrediction(
    initial,
    (state, input: { value: number }) => ({
      ...state,
      local: state.local + input.value,
    }),
    capacity
  );

test('reconciliation reapplies only unacknowledged local projections and preserves authoritative results', () => {
  const client = prediction();
  expect(client.submit(3, 2)?.sequence).toBe(1);
  expect(client.submit(4, 3)?.sequence).toBe(2);
  expect(client.state()).toEqual({ local: 7, remote: 10, score: 0 });
  expect(
    client.reconcile({
      ...initial,
      tick: 2,
      acknowledged: 1,
      state: { local: 2, remote: 20, score: 1 },
    })
  ).toBe(true);
  expect(client.state()).toEqual({ local: 6, remote: 20, score: 1 });
  expect(client.pendingCount()).toBe(1);
  expect(
    client.reconcile({
      ...initial,
      tick: 3,
      acknowledged: 2,
      state: { local: 5, remote: 22, score: 1 },
    })
  ).toBe(true);
  expect(client.state()).toEqual({ local: 5, remote: 22, score: 1 });
  expect(client.pendingCount()).toBe(0);
});

test('duplicate, stale and wrong-round snapshots cannot rewind prediction', () => {
  const client = prediction();
  client.submit(4, 3);
  const snapshot = { ...initial, tick: 2, acknowledged: 1 };
  expect(client.reconcile(snapshot)).toBe(true);
  for (const stale of [
    snapshot,
    { ...snapshot, tick: 1 },
    { ...snapshot, tick: 3, epoch: 'race-round-0' },
    { ...snapshot, tick: 3, acknowledged: 0 },
    { ...snapshot, tick: 3, acknowledged: 2 },
  ])
    expect(client.reconcile(stale)).toBe(false);
  expect(client.state()).toEqual(snapshot.state);
});

test('bounded prediction refuses overflow and reconnect discards old inputs and sequence numbers', () => {
  const client = prediction(1);
  expect(client.submit(3, 1)).not.toBeNull();
  expect(client.submit(4, 2)).toBeNull();
  client.reset({
    ...initial,
    epoch: 'race-round-2',
    tick: 90,
    acknowledged: 12,
  });
  expect(client.pendingCount()).toBe(0);
  expect(client.submit(4, 90)).toBeNull();
  expect(client.submit(4, 91)?.sequence).toBe(13);
});

// regression: simulation-expired-prediction
test('an unacknowledged tick-three input is discarded once authoritative tick four has passed it', () => {
  const client = prediction();
  client.submit(4, 3);
  const state = { local: 2, remote: 20, score: 1 };
  expect(
    client.reconcile({ ...initial, tick: 4, acknowledged: 0, state })
  ).toBe(true);
  expect(client.pendingCount()).toBe(0);
  expect(client.state()).toEqual(state);
});

test('interpolation samples a fractional logical tick, holds gaps and ignores old snapshots', () => {
  const frames = new SnapshotInterpolation<number>(
    (a, b, t) => a + (b - a) * t,
    2
  );
  expect(frames.sample(0)).toBeNull();
  expect(frames.push({ tick: 10, state: 20 })).toBe(true);
  expect(frames.push({ tick: 20, state: 40 })).toBe(true);
  expect(frames.sample(15)).toBe(30);
  expect(frames.sample(0)).toBe(20);
  expect(frames.sample(200)).toBe(40);
  expect(frames.push({ tick: 20, state: -1 })).toBe(false);
  expect(frames.push({ tick: 19, state: -1 })).toBe(false);
  frames.push({ tick: 30, state: 60 });
  expect(frames.sample(0)).toBe(40);
  frames.reset();
  expect(frames.sample(20)).toBeNull();
});

test('interpolated values stay within received endpoints for every fractional sample', () => {
  assertProperty(
    'interpolation endpoint bounds',
    fc.property(
      fc.integer(),
      fc.integer(),
      fc.integer({ min: 0, max: 1000 }),
      (a, b, fraction) => {
        const frames = new SnapshotInterpolation<number>(
          (from, to, t) => from + (to - from) * t,
          3
        );
        frames.push({ tick: 0, state: a });
        frames.push({ tick: 1000, state: b });
        const value = frames.sample(fraction)!;
        expect(value).toBeGreaterThanOrEqual(Math.min(a, b));
        expect(value).toBeLessThanOrEqual(Math.max(a, b));
      }
    )
  );
});
