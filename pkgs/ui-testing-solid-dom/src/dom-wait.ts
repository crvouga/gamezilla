import type { Clock } from '@pkgs/clock/types';
import { TimeoutError } from '@pkgs/ui-testing/core/errors';

/**
 * Advance product work between wait checks (the harness's `runFor(0)`).
 * Structurally identical to `@pkgs/ui-testing`'s `WaitPump`; declared here so
 * this Solid package does not pull the UI `@pkgs/clock` root into its
 * type program.
 */
export type WaitPump = () => void | Promise<void>;

export const DEFAULT_WAIT_TIMEOUT_MS = 5_000;

/**
 * Consecutive pumps with neither a DOM mutation nor clock progress before the
 * wait gives up. Guards against an unbounded spin when the injected clock is
 * virtual and the pump has nothing left to run.
 */
const STALLED_PUMP_LIMIT = 10_000;

export type WaitForDomOptions = {
  /** Root observed for mutations (actor container's document body). */
  readonly target: Node;
  /** Deadline clock — wall, or a virtual clock the pump advances. */
  readonly clock: Clock;
  /** Drives product work between checks (harness `runFor(0)`); default microtask. */
  readonly pump: WaitPump;
  readonly timeoutMs: number;
  readonly description: string;
};

export const microtaskPump: WaitPump = async () => {
  await Promise.resolve();
};

type MutationTracker = {
  readonly takeMutated: () => boolean;
  readonly disconnect: () => void;
};

function observeMutations(target: Node): MutationTracker {
  let mutated = false;
  const observer = new MutationObserver(() => {
    mutated = true;
  });
  observer.observe(target, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  return {
    takeMutated: () => {
      const value = mutated;
      mutated = false;
      return value;
    },
    disconnect: () => observer.disconnect(),
  };
}

/**
 * Runtime-native wait: no timer polling. Each round pumps the host once,
 * lets `MutationObserver` records deliver, then re-checks. Bounded by
 * `timeoutMs` on the injected clock. Throws {@link TimeoutError}.
 */
export async function waitForDom(
  check: () => boolean,
  options: WaitForDomOptions
): Promise<void> {
  if (check()) return;
  const { clock, pump, timeoutMs, description } = options;
  const deadline = clock.now() + timeoutMs;
  const tracker = observeMutations(options.target);
  let stalled = 0;
  try {
    for (;;) {
      const before = clock.now();
      await pump();
      await Promise.resolve();
      const mutated = tracker.takeMutated();
      if (check()) return;
      const now = clock.now();
      if (now >= deadline) {
        throw new TimeoutError(
          `Timed out after ${timeoutMs}ms waiting for ${description}`,
          timeoutMs
        );
      }
      stalled = mutated || now !== before ? 0 : stalled + 1;
      if (stalled >= STALLED_PUMP_LIMIT) {
        throw new TimeoutError(
          `Timed out after ${timeoutMs}ms waiting for ${description} — no DOM mutation or clock progress across ${STALLED_PUMP_LIMIT} pumps`,
          timeoutMs
        );
      }
    }
  } finally {
    tracker.disconnect();
  }
}
