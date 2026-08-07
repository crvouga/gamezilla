/**
 * Manages pull-to-refresh spinner state around an async action.
 *
 * When `refreshing` is passed, state is controlled by the caller. Otherwise
 * this hook sets refreshing true for the duration of `action`.
 */

import { useCallback, useState } from 'react';

export type UsePullToRefreshResult = {
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
};

export function usePullToRefresh(
  action: (() => void | Promise<void>) | undefined,
  refreshingControlled?: boolean
): UsePullToRefreshResult | null {
  const [internal, setInternal] = useState(false);

  const onRefresh = useCallback(() => {
    if (action === undefined) return;
    void (async () => {
      if (refreshingControlled === undefined) setInternal(true);
      try {
        await action();
      } finally {
        if (refreshingControlled === undefined) setInternal(false);
      }
    })();
  }, [action, refreshingControlled]);

  if (action === undefined) return null;

  return {
    refreshing: refreshingControlled ?? internal,
    onRefresh,
  };
}
