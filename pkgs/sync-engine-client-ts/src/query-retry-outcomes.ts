import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { QueryRetryNotice } from '@pkgs/sync-engine-shared-ts/define-query';

type Listener = (notice: QueryRetryNotice | null) => void;
/** Scoped retry notices and their owned wakeups; no global connection changes. */
export function createQueryRetryOutcomes(
  timers: Timers,
  retry: (scope: string) => void
) {
  const notices = new Map<string, QueryRetryNotice>();
  const listeners = new Map<string, Set<Listener>>();
  const pending = new Map<string, unknown>();
  const cancel = (scope: string): void => {
    const timer = pending.get(scope);
    if (timer !== undefined) timers.clearTimeout(timer);
    pending.delete(scope);
  };
  const publish = (scope: string, notice: QueryRetryNotice | null): void => {
    for (const listener of listeners.get(scope) ?? []) listener(notice);
  };
  return {
    failed: (scope: string) => notices.has(scope),
    subscribe(scope: string, listener: Listener): () => void {
      const set = listeners.get(scope) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(scope, set);
      listener(notices.get(scope) ?? null);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(scope);
      };
    },
    set(scope: string, notice: QueryRetryNotice | null): void {
      cancel(scope);
      if (notice === null) notices.delete(scope);
      else {
        notices.set(scope, notice);
        pending.set(
          scope,
          timers.setTimeout(
            () => {
              pending.delete(scope);
              retry(scope);
            },
            Math.max(1, notice.retryAfterMs)
          )
        );
      }
      publish(scope, notice);
    },
    remove(scope: string): void {
      cancel(scope);
      notices.delete(scope);
      listeners.delete(scope);
    },
    stop(): void {
      for (const scope of pending.keys()) cancel(scope);
    },
  };
}
