import { expect, test } from 'bun:test';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  quintBinding,
} from '@pkgs/quint-shared/registry';
import './quint/index';

test('custom game keeps its complete induction proof within the original bounds', () => {
  // regression: custom-game-proof-solver-timeout
  const binding = quintBinding('custom-game');
  expect(binding.inductiveInvariant).toBe('_inductive');
  expect(binding.separateInduction).toBe(true);
  expect(binding.inductionCaseGroupSize).toBe(8);
  expect(binding.invariantMode).toBe('before');
  expect(binding.verifySteps ?? DEFAULT_VERIFY_STEPS).toBe(4);
  expect(binding.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS).toBe(240_000);
});
