import { expect, test } from 'bun:test';
import {
  REMOVE_ATTEMPTS,
  removeTemporaryDirectory,
} from '../scripts/remove-temporary-directory';

function busy(): Error {
  return Object.assign(new Error('EBUSY: resource busy or locked'), {
    code: 'EBUSY',
  });
}

function ports(failures: number) {
  const calls = { removed: 0, slept: [] as number[], warned: [] as string[] };
  return {
    calls,
    ports: {
      remove: () => {
        calls.removed += 1;
        if (calls.removed <= failures) throw busy();
      },
      sleep: (ms: number) => {
        calls.slept.push(ms);
        return Promise.resolve();
      },
      warn: (message: string) => {
        calls.warned.push(message);
      },
    },
  };
}

// regression: release-journeys-teardown-ebusy
test('a directory Windows still holds is removed once the locks go, without a warning', async () => {
  // Verify run 40769518282: every scenario passed, then the stack's data
  // directory was EBUSY and the throw made the task exit 1.
  const { calls, ports: io } = ports(3);
  await removeTemporaryDirectory('stack-data', io);
  expect(calls.removed).toBe(4);
  expect(calls.slept).toHaveLength(3);
  expect(calls.warned).toEqual([]);
});

test('a directory that stays locked is reported and left, never thrown', async () => {
  const { calls, ports: io } = ports(Number.POSITIVE_INFINITY);
  await removeTemporaryDirectory('stack-data', io);
  expect(calls.removed).toBe(REMOVE_ATTEMPTS);
  expect(calls.slept).toHaveLength(REMOVE_ATTEMPTS - 1);
  expect(calls.warned).toHaveLength(1);
  expect(calls.warned[0]).toContain('stack-data');
});

test('an unlocked directory is removed at once', async () => {
  const { calls, ports: io } = ports(0);
  await removeTemporaryDirectory('stack-data', io);
  expect(calls).toEqual({ removed: 1, slept: [], warned: [] });
});
