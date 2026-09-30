import { useTimers } from '@pkgs/clock/solid';
import { useSyncEngineInstance } from '@pkgs/sync-engine/solid';

import {
  CONNECTION_CHECK_BUDGET_MS,
  onlineAfterRefresh,
} from '../../public/answer-connection';

/**
 * Spaces are live and shared, so starting or joining one needs the server.
 * Asks it (one query sweep) instead of trusting a status that only learns of
 * a lost connection on the next failed request. The sweep has a deadline:
 * one that never finishes must not leave the button on "Joining…".
 */
export function useCheckConnection(): () => Promise<boolean> {
  const engine = useSyncEngineInstance();
  const timers = useTimers();
  return () =>
    onlineAfterRefresh({
      refresh: () => engine.refreshQueries(),
      online: () => engine.status.getSnapshot().online,
      budgetMs: CONNECTION_CHECK_BUDGET_MS,
      schedule: (ms, run) => {
        const handle = timers.setTimeout(run, ms);
        return () => {
          timers.clearTimeout(handle);
        };
      },
    });
}
