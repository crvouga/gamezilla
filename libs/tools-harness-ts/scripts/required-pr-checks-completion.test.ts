import { expect, test } from 'bun:test';
import { type PrCheck, requiredPrCheckFailures } from './required-pr-checks';
import { completedPrChecks } from './required-pr-checks-completion';

const required = [
  { context: 'CodeQL', integration_id: 57789 },
  { context: 'Analyze (javascript-typescript)', integration_id: 15368 },
];
const pending: readonly PrCheck[] = [
  { name: 'CodeQL', appId: 57789, status: 'completed', conclusion: 'neutral' },
  {
    name: 'Analyze (javascript-typescript)',
    appId: 15368,
    status: 'in_progress',
    conclusion: null,
  },
  { name: 'verify:end', appId: 15368, status: 'in_progress', conclusion: null },
];
const passed = pending.map((check) =>
  check.name === 'verify:end'
    ? check
    : {
        ...check,
        status: 'completed',
        conclusion: 'success',
      }
);

// regression: pr-final-gate-precedes-codeql-completion
test('run 42457760955 waits for running CodeQL analysis before judging its neutral aggregate', async () => {
  let settled = false;
  let reads = 0;
  const checks = await completedPrChecks(
    required,
    () => {
      reads++;
      return settled ? passed : pending;
    },
    async () => {
      settled = true;
    }
  );
  expect(reads).toBe(2);
  expect(requiredPrCheckFailures(required, checks, false)).toEqual([]);
});

test('a terminal neutral CodeQL outcome still fails without re-executing any check', async () => {
  let pauses = 0;
  const terminal = pending.map((check) =>
    check.name === 'Analyze (javascript-typescript)'
      ? {
          ...check,
          status: 'completed',
          conclusion: 'success',
        }
      : check
  );
  const checks = await completedPrChecks(
    required,
    () => terminal,
    async () => {
      pauses++;
    }
  );
  expect(pauses).toBe(0);
  expect(requiredPrCheckFailures(required, checks, false)).toEqual([
    'Required check did not pass: CodeQL (neutral)',
  ]);
});

test('the aggregate never waits for itself or trusts an unknown pending integration', async () => {
  let pauses = 0;
  const unknown = {
    name: 'Unknown',
    appId: 123,
    status: 'in_progress',
    conclusion: null,
  };
  const checks = await completedPrChecks(
    required,
    () => [...passed, unknown],
    async () => {
      pauses++;
    }
  );
  expect(pauses).toBe(0);
  expect(requiredPrCheckFailures(required, checks, false).join()).toContain(
    'Optional or untrusted check: Unknown'
  );
});
