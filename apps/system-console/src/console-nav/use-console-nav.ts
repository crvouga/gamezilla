import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  type ConsoleNavPatch,
  type ConsoleNavState,
  consoleNavEqual,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
} from '@apps/system-console/console-nav/console-nav';
import {
  type ConsoleNavHistoryMode,
  isConsoleNavWeb,
  readConsoleNavFromPopState,
  readConsoleNavSearch,
  subscribeConsoleNavPopState,
  writeConsoleNavUrl,
} from '@apps/system-console/console-nav/console-nav-wall';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type UseConsoleNavResult = {
  readonly state: ConsoleNavState;
  readonly patch: (
    partial: ConsoleNavPatch,
    mode?: ConsoleNavHistoryMode
  ) => void;
};

function initialConsoleNav(): ConsoleNavState {
  if (Platform.OS !== 'web' || !isConsoleNavWeb()) return DEFAULT_CONSOLE_NAV;
  return parseConsoleNav(readConsoleNavSearch());
}

/**
 * Console chrome selection synced to the browser URL on web (push/replace +
 * popstate). Native keeps the same React state without history I/O.
 */
export function useConsoleNav(): UseConsoleNavResult {
  const [state, setState] = useState(initialConsoleNav);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (Platform.OS !== 'web' || !isConsoleNavWeb()) return;
    const boot = parseConsoleNav(readConsoleNavSearch());
    writeConsoleNavUrl(
      buildConsoleSearch(boot, readConsoleNavSearch()),
      boot,
      'replace'
    );
    return subscribeConsoleNavPopState((event) => {
      const fromState = readConsoleNavFromPopState(event);
      if (fromState !== null) {
        setState(applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, fromState));
        return;
      }
      setState(parseConsoleNav(readConsoleNavSearch()));
    });
  }, []);

  const patch = useCallback(
    (partial: ConsoleNavPatch, mode: ConsoleNavHistoryMode = 'push') => {
      const next = applyConsoleNavPatch(stateRef.current, partial);
      if (consoleNavEqual(stateRef.current, next)) return;
      if (Platform.OS === 'web' && isConsoleNavWeb()) {
        writeConsoleNavUrl(
          buildConsoleSearch(next, readConsoleNavSearch()),
          next,
          mode
        );
      }
      stateRef.current = next;
      setState(next);
    },
    []
  );

  return { state, patch };
}
