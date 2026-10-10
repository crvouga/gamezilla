import { expect, test } from 'bun:test';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  quintBinding,
} from '@pkgs/quint-shared/registry';
import './quint/index';

test('username proof retains its bounds with grouped array-encoded maps', () => {
  // regression: username-proof-solver-timeout
  const binding = quintBinding('username-changes');
  expect(binding.encoding).toBe('fun-arrays');
  expect(binding.inferPolymorphicTypes).toBe(false);
  expect(binding.invariantMode).toBe('before');
  expect(binding.boundedInvariantGroupSize).toBe(6);
  expect(binding.verifySteps ?? DEFAULT_VERIFY_STEPS).toBe(4);
  expect(binding.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS).toBe(240_000);
});
