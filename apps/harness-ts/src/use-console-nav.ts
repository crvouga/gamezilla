import { createSignal, onCleanup } from 'solid-js';
import type { ConsoleNavPatch, ConsoleNavState } from './console-nav';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  consoleNavEqual,
  parseConsoleNav,
} from './console-nav';
import type { ConsoleNavHistoryMode } from './console-nav-real';
import {
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
  // The latest state is held outside the signal so a patch made before the
  // view settles builds on the patch before it.
  let current = parseConsoleNav(readConsoleNavSearch());
  const [state, setState] = createSignal(current);
  const commit = (next: ConsoleNavState): void => {
    current = next;
    setState(next);
  };
  writeConsoleNavUrl(
    buildConsoleSearch(current, readConsoleNavSearch()),
    current,
    'replace'
  );
  onCleanup(
    subscribeConsoleNavPopState(() => {
      commit(parseConsoleNav(readConsoleNavSearch()));
    })
  );
  return {
    get state() {
      return state();
    },
    patch(partial, mode = 'push') {
      const next = applyConsoleNavPatch(current, partial);
      if (consoleNavEqual(current, next)) return;
      // A view change hands the keyboard back; a change of panel keeps the
      // control it was made from focused.
      if (partial.pane !== undefined) releaseConsoleFocus();
      writeConsoleNavUrl(
        buildConsoleSearch(next, readConsoleNavSearch()),
        next,
        mode
      );
      commit(next);
    },
  };
}
