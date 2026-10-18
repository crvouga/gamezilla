import { ratedStartKey } from '@libs/game-puzzle-shared/rated-start-key';
import { usePermissions } from '@libs/permissions-client/use-permissions';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import { useClock, useTimers } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

/** Consumes the rated-puzzle quota when a puzzle is started (§22.4). */
export type RatedStartGate = {
  /** The denial that blocked the last start, until a retry clears it. */
  readonly denial: Accessor<Decision | null>;
  /** Consume for starting `puzzleId`; resolves whether it may start. */
  readonly start: (puzzleId: string) => Promise<boolean>;
};

/**
 * Rated puzzles are charged when started, never when finished, so a puzzle on
 * the board always completes. The idempotency key is the puzzle placed on the
 * client's day: a reload or replay that re-places the same puzzle is a no-op.
 * A denial retries at `resetsAtMs` or as soon as policy / facts allow again.
 */
export function useRatedStartGate(onRetry: () => void): RatedStartGate {
  const permissions = usePermissions();
  const clock = useClock();
  const timers = useTimers();
  const [denial, setDenial] = createSignal<Decision | null>(null);
  let retryHandle: unknown = null;

  const clearRetry = (): void => {
    if (retryHandle !== null) timers.clearTimeout(retryHandle);
    retryHandle = null;
  };
  const retry = (): void => {
    clearRetry();
    setDenial(null);
    onRetry();
  };
  onCleanup(clearRetry);

  // Edge-triggered: retry only when a policy / fact change flips the local
  // answer from denied to allowed. A level trigger would spin if the local
  // hint and the consume ever disagreed.
  createEffect<boolean>((wasAllowed) => {
    const allowed = permissions.can(ACTION.puzzleRatedSolve).allowed;
    if (denial() !== null && allowed && !wasAllowed) retry();
    return allowed;
  }, true);

  const start = async (puzzleId: string): Promise<boolean> => {
    const key = ratedStartKey(puzzleId, clock.now());
    const decision = await permissions.consume(ACTION.puzzleRatedSolve, key);
    if (decision.allowed) {
      setDenial(null);
      return true;
    }
    clearRetry();
    setDenial(decision);
    if (decision.resetsAtMs !== undefined) {
      retryHandle = timers.setTimeout(
        retry,
        Math.max(0, decision.resetsAtMs - clock.now())
      );
    }
    return false;
  };

  return { denial, start };
}
