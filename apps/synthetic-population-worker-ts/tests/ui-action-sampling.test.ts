import { expect, test } from 'bun:test';
import { UiActionSampling } from '@apps/synthetic-population-worker-ts/ui-action-sampling';

test('repeated UI telemetry reports the accumulated count while every failure remains observable', () => {
  const sampling = new UiActionSampling();
  const action = 'paddle: input';
  expect(sampling.record({ action, atMs: 0, outcome: 'started' })).toBe(1);
  expect(sampling.record({ action, atMs: 1, outcome: 'completed' })).toBe(1);
  for (const atMs of [100, 200, 4999])
    expect(sampling.record({ action, atMs, outcome: 'started' })).toBeNull();
  expect(sampling.record({ action, atMs: 5000, outcome: 'started' })).toBe(4);
  expect(sampling.record({ action, atMs: 5001, outcome: 'failed' })).toBe(1);
  expect(sampling.record({ action, atMs: 5002, outcome: 'failed' })).toBe(1);
});
