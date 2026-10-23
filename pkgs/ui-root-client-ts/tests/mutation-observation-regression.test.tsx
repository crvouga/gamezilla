/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  type UseMutationLifecycleResult,
  useMutationLifecycle,
} from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { render } from '@solidjs/testing-library';

// regression: mutation-observation-never-settles
test('an uncertain choice stops spinning and checking it does not submit again', async () => {
  const { clock, timers } = createHarnessClock();
  let finish!: () => void;
  let calls = 0;
  const operation = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let lifecycle!: UseMutationLifecycleResult;
  const Probe = () => {
    lifecycle = useMutationLifecycle({
      operation: () => {
        calls++;
        return operation;
      },
    });
    return null;
  };
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <Probe />
    </ClockProvider>
  ));
  const first = lifecycle.run();
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  clock.advance(15_000);
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  try {
    expect(lifecycle.phase()).toBe('error');
    expect(lifecycle.error()?.name).toBe('MutationOutcomeUnknownError');
    lifecycle.reset();
    const checking = lifecycle.run();
    expect(calls).toBe(1);
    finish();
    await Promise.all([first, checking]);
    expect(lifecycle.phase()).toBe('success');
    expect(clock.pendingOneShotCount()).toBe(0);
  } finally {
    finish();
    await first;
    view.unmount();
  }
});
