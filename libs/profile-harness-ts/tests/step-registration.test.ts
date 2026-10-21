import { expect, test } from 'bun:test';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';
import './steps/index';

// regression: flat-harness-step-registration
test('the suite registers exported profile steps alongside private steps', () => {
  expect(matchStep("Alice's username is @alice_guest").kind).toBe('match');
});
