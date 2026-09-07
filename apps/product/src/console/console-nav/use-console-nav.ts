import { createSignal, onCleanup } from 'solid-js';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  type ConsoleNavPatch,
  type ConsoleNavState,
  consoleNavEqual,
  parseConsoleNav,
} from './console-nav';
import {
  type ConsoleNavHistoryMode,
  readConsoleNavSearch,
  releaseConsoleFocus,
  subscribeConsoleNavPopState,
  writeConsoleNavUrl,
} from './console-nav-real';

export type UseConsoleNavResult = {
  readonly state: ConsoleNavState;
  readonly patch: (
    partial: ConsoleNavPatch,
    mode?: ConsoleNavHistoryMode
  ) => void;
};

/** Property-shaped reactive state; URL is authoritative for back/forward. */
export function useConsoleNav(): UseConsoleNavResult {
  const [state, setState] = createSignal(
    parseConsoleNav(readConsoleNavSearch())
  );
  writeConsoleNavUrl(
    buildConsoleSearch(state(), readConsoleNavSearch()),
    state(),
    'replace'
  );
  onCleanup(
    subscribeConsoleNavPopState(() => {
      setState(parseConsoleNav(readConsoleNavSearch()));
    })
  );
  return {
    get state() {
      return state();
    },
    patch(partial, mode = 'push') {
      const next = applyConsoleNavPatch(state(), partial);
      if (consoleNavEqual(state(), next)) return;
      releaseConsoleFocus();
      writeConsoleNavUrl(
        buildConsoleSearch(next, readConsoleNavSearch()),
        next,
        mode
      );
      setState(next);
    },
  };
}
