import { expect, test } from 'bun:test';
import type { StageOverlayPhase } from '@pkgs/turn-game-client-ts/stage-overlay';
import {
  type StageOverlayTimers,
  useStageOverlay,
} from '@pkgs/turn-game-client-ts/use-stage-overlay';
import { createRoot, createSignal } from 'solid-js';

/** Timers a test fires by hand. */
function handTimers(): StageOverlayTimers & { fire: () => number } {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    setTimeout: (fn) => {
      next += 1;
      pending.set(next, fn);
      return next;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number);
    },
    fire: () => {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, fn] of due) fn();
      return due.length;
    },
  };
}

function mounted<T>(body: (dispose: () => void) => T): T {
  return createRoot((dispose) => body(dispose));
}

test('a game this device watched begin counts down from three to its board', async () => {
  const timers = handTimers();
  const [phase, setPhase] = createSignal<StageOverlayPhase>('setup');
  const { control, dispose } = mounted((dispose) => ({
    control: useStageOverlay(phase, timers),
    dispose,
  }));
  expect(control.overlay()).toEqual({ kind: 'none' });
  setPhase('play');
  const seen: unknown[] = [control.overlay()];
  for (let second = 0; second < 3; second += 1) {
    await Promise.resolve();
    expect(timers.fire()).toBe(1);
    seen.push(control.overlay());
  }
  expect(seen).toEqual([
    { kind: 'versus', count: 3 },
    { kind: 'versus', count: 2 },
    { kind: 'versus', count: 1 },
    { kind: 'none' },
  ]);
  await Promise.resolve();
  // The board is bare: no timer is left running.
  expect(timers.fire()).toBe(0);
  dispose();
});

test('a game opened while it is played shows its board at once', () => {
  const timers = handTimers();
  mounted((dispose) => {
    const control = useStageOverlay(() => 'play', timers);
    expect(control.overlay()).toEqual({ kind: 'none' });
    dispose();
  });
});

test('a game still being read and then found in play shows its board at once', async () => {
  const timers = handTimers();
  const [phase, setPhase] = createSignal<StageOverlayPhase>('unknown');
  const { control, dispose } = mounted((dispose) => ({
    control: useStageOverlay(phase, timers),
    dispose,
  }));
  setPhase('play');
  await Promise.resolve();
  expect(control.overlay()).toEqual({ kind: 'none' });
  expect(timers.fire()).toBe(0);
  dispose();
});

test('a press skips the count and its timer', async () => {
  const timers = handTimers();
  const [phase, setPhase] = createSignal<StageOverlayPhase>('setup');
  const { control, dispose } = mounted((dispose) => ({
    control: useStageOverlay(phase, timers),
    dispose,
  }));
  setPhase('play');
  await Promise.resolve();
  control.send({ type: 'skip' });
  await Promise.resolve();
  expect(control.overlay()).toEqual({ kind: 'none' });
  expect(timers.fire()).toBe(0);
  dispose();
});

test('the end of the game shows the result, which closes and reopens; setting up again clears it', () => {
  const timers = handTimers();
  const [phase, setPhase] = createSignal<StageOverlayPhase>('play');
  const { control, dispose } = mounted((dispose) => ({
    control: useStageOverlay(phase, timers),
    dispose,
  }));
  setPhase('over');
  expect(control.overlay()).toEqual({ kind: 'outcome' });
  control.send({ type: 'dismiss' });
  expect(control.overlay()).toEqual({ kind: 'board' });
  control.send({ type: 'show' });
  expect(control.overlay()).toEqual({ kind: 'outcome' });
  setPhase('setup');
  expect(control.overlay()).toEqual({ kind: 'none' });
  dispose();
});
