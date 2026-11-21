import { expect, test } from 'bun:test';
import { withScenarioCleanup } from '@pkgs/gherkin-server-ts/scenario-cleanup';

// regression: scenario-disposal-masks-original-failure
test('a failed scenario and its failed final monitor both survive cleanup', async () => {
  const step = new Error('Alice could not sign out');
  const teardown = new Error(
    'global action menu not visible for actor(s): alice'
  );
  let caught: unknown;
  try {
    await withScenarioCleanup(
      async () => {
        throw step;
      },
      async () => {
        throw teardown;
      }
    );
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AggregateError);
  expect((caught as AggregateError).errors).toEqual([step, teardown]);
  expect((caught as Error).cause).toBe(step);
  expect((caught as Error).message).toContain(step.message);
  expect((caught as Error).message).toContain(teardown.message);
});

test('successful cleanup preserves the original failure object', async () => {
  const step = new Error('failed step');
  await expect(
    withScenarioCleanup(
      async () => {
        throw step;
      },
      async () => {}
    )
  ).rejects.toBe(step);
});

test('failed cleanup still fails an otherwise successful scenario', async () => {
  const teardown = new Error('failed final invariant');
  await expect(
    withScenarioCleanup(
      async () => true,
      async () => {
        throw teardown;
      }
    )
  ).rejects.toBe(teardown);
});

test('successful cleanup retains the result and executes once', async () => {
  const calls: string[] = [];
  expect(
    await withScenarioCleanup(
      async () => {
        calls.push('step');
        return false;
      },
      async () => {
        calls.push('cleanup');
      }
    )
  ).toBe(false);
  expect(calls).toEqual(['step', 'cleanup']);
});
