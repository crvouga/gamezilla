import { expect, test } from 'bun:test';
import { specWorkers } from './spec-sources';

// regression: stack-population-fixture-collisions
test('a stack-serial package runs one scenario at a time only on a stack', () => {
  const serial = { stackSerial: true };
  expect(specWorkers({ HARNESS_MODE: 'stack' }, serial, 4)).toBe(1);
  expect(specWorkers({}, serial, 4)).toBe(4);
  expect(specWorkers({ HARNESS_MODE: 'real' }, serial, 4)).toBe(4);
  expect(specWorkers({ HARNESS_MODE: 'stack' }, {}, 4)).toBe(4);
});
