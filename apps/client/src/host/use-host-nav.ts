import {
  applyHostNavPatch,
  buildHostSearch,
  DEFAULT_HOST_NAV,
  type HostNavPatch,
  type HostNavState,
  hostNavEqual,
  parseHostNav,
} from '@apps/client/host/host-nav';
import {
  type HostNavHistoryMode,
  isHostNavWeb,
  readHostNavFromPopState,
  readHostNavSearch,
  subscribeHostNavPopState,
  writeHostNavUrl,
} from '@apps/client/host/host-nav-wall';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type UseHostNavResult = {
  readonly state: HostNavState;
  readonly patch: (partial: HostNavPatch, mode?: HostNavHistoryMode) => void;
};

function initialHostNav(): HostNavState {
  if (Platform.OS !== 'web' || !isHostNavWeb()) return DEFAULT_HOST_NAV;
  return parseHostNav(readHostNavSearch());
}

/**
 * Host chrome selection synced to the browser URL on web (push/replace +
 * popstate). Native keeps the same React state without history I/O.
 */
export function useHostNav(): UseHostNavResult {
  const [state, setState] = useState(initialHostNav);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (Platform.OS !== 'web' || !isHostNavWeb()) return;
    const boot = parseHostNav(readHostNavSearch());
    writeHostNavUrl(
      buildHostSearch(boot, readHostNavSearch()),
      boot,
      'replace'
    );
    return subscribeHostNavPopState((event) => {
      const fromState = readHostNavFromPopState(event);
      if (fromState !== null) {
        setState(applyHostNavPatch(DEFAULT_HOST_NAV, fromState));
        return;
      }
      setState(parseHostNav(readHostNavSearch()));
    });
  }, []);

  const patch = useCallback(
    (partial: HostNavPatch, mode: HostNavHistoryMode = 'push') => {
      const next = applyHostNavPatch(stateRef.current, partial);
      if (hostNavEqual(stateRef.current, next)) return;
      if (Platform.OS === 'web' && isHostNavWeb()) {
        writeHostNavUrl(buildHostSearch(next, readHostNavSearch()), next, mode);
      }
      stateRef.current = next;
      setState(next);
    },
    []
  );

  return { state, patch };
}
