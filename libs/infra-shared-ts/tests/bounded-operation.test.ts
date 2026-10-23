import { expect, test } from 'bun:test';
import { boundedOperation } from '@libs/infra-shared-ts/bounded-operation';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

// regression: infra-drift-operation-hang
test('a foundation credential read that never settles names the blocked operation and aborts', async () => {
  const { clock, timers } = createHarnessClock();
  const reports: string[] = [];
  let signal: AbortSignal | undefined;
  let error: unknown;
  const result = boundedOperation(
    (abort) => {
      signal = abort;
      return new Promise(() => {});
    },
    clock,
    timers,
    {
      label: 'foundation/dev: AWS credentials',
      timeoutMs: 30_000,
      report: (message) => reports.push(message),
    }
  ).catch((failure: unknown) => {
    error = failure;
  });
  clock.advance(30_000);
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  expect(String(error)).toContain(
    'foundation/dev: AWS credentials exceeded 30000ms'
  );
  expect(signal?.aborted).toBe(true);
  await result;
  expect(clock.pendingOneShotCount()).toBe(0);
  expect(reports).toEqual([
    'foundation/dev: AWS credentials: started',
    'foundation/dev: AWS credentials: failed after 30000ms',
  ]);
});

test('a completed read cancels its deadline and preserves its result', async () => {
  const { clock, timers } = createHarnessClock();
  expect(
    await boundedOperation(async () => 2, clock, timers, {
      label: 'edge plan',
      timeoutMs: 300_000,
      report: () => {},
    })
  ).toBe(2);
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('a failed read preserves the failure and cancels its deadline', async () => {
  const { clock, timers } = createHarnessClock();
  const failure = new Error('state lock denied');
  const result = boundedOperation(
    async () => {
      throw failure;
    },
    clock,
    timers,
    { label: 'edge plan', timeoutMs: 300_000, report: () => {} }
  );
  expect(await result.catch((error: unknown) => error)).toBe(failure);
  expect(clock.pendingOneShotCount()).toBe(0);
});
