import { describe, expect, test } from 'bun:test';
import {
  MULTIPLAYER_LINK_DEADLINE_MS,
  type MultiplayerLinkOpening,
  type MultiplayerLinkTarget,
  startMultiplayerLinkAttempt,
} from '@libs/game-matchmaking-client-ts/multiplayer-link-attempt';

/** One-shot timers the test fires by hand. */
function manualTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 0;
  return {
    timers: {
      setTimeout: (fn: () => void, ms: number) => {
        next += 1;
        pending.set(next, { fn, ms });
        return next;
      },
      clearTimeout: (handle: unknown) => {
        pending.delete(handle as number);
      },
    },
    pending: () => [...pending.values()],
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      for (const timer of due) timer.fn();
    },
  };
}

function attempt(resolveTarget: () => Promise<MultiplayerLinkTarget>) {
  const clock = manualTimers();
  const outcomes: MultiplayerLinkOpening[] = [];
  const opened: string[] = [];
  const current = startMultiplayerLinkAttempt({
    timers: clock.timers,
    resolveTarget,
    openSpace: (spaceId) => opened.push(spaceId),
    settle: (outcome) => outcomes.push(outcome),
  });
  const last = () => outcomes.at(-1)?.kind;
  return { ...clock, current, outcomes, opened, last };
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('opening the multiplayer link', () => {
  // regression: multiplayer-link-spins-forever
  test('a space that cannot be created ends in a retryable failure, not a spinner', async () => {
    const run = attempt(() =>
      Promise.reject(
        new Error('This space already belongs to another account.')
      )
    );
    run.current.ready();
    await flush();
    await flush();
    expect(run.last()).toBe('failed');
    expect(run.opened).toEqual([]);
    expect(run.pending()).toEqual([]);
  });

  // regression: multiplayer-link-spins-forever
  test('a space with no id ends in failure', async () => {
    const run = attempt(() =>
      Promise.resolve({ kind: 'space', spaceId: undefined })
    );
    run.current.ready();
    await flush();
    await flush();
    expect(run.last()).toBe('failed');
    expect(run.opened).toEqual([]);
  });

  // regression: multiplayer-link-spins-forever
  test('a local answer that never comes fails at the deadline', () => {
    const run = attempt(() => new Promise<MultiplayerLinkTarget>(() => {}));
    expect(run.last()).toBe('opening');
    expect(run.pending().map((timer) => timer.ms)).toEqual([
      MULTIPLAYER_LINK_DEADLINE_MS,
    ]);
    run.fireAll();
    expect(run.last()).toBe('failed');
  });

  test('a space that resolves after the deadline is not opened', async () => {
    const late = Promise.withResolvers<MultiplayerLinkTarget>();
    const run = attempt(() => late.promise);
    run.current.ready();
    run.fireAll();
    late.resolve({ kind: 'space', spaceId: 'space-1' });
    await flush();
    await flush();
    expect(run.opened).toEqual([]);
    expect(run.last()).toBe('failed');
  });

  test('the hosted space opens and the deadline is released', async () => {
    const run = attempt(() =>
      Promise.resolve({ kind: 'space', spaceId: 'space-1' })
    );
    run.current.ready();
    run.current.ready();
    await flush();
    await flush();
    expect(run.opened).toEqual(['space-1']);
    expect(run.pending()).toEqual([]);
  });

  test('a cancelled try leaves nothing pending and opens nothing', async () => {
    const run = attempt(() =>
      Promise.resolve({ kind: 'space', spaceId: 'space-1' })
    );
    run.current.ready();
    run.current.cancel();
    await flush();
    await flush();
    expect(run.opened).toEqual([]);
    expect(run.pending()).toEqual([]);
  });
});
