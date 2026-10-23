// @io-wall-ok
import type { ConsoleNavState } from './console-nav';

export type ConsoleNavHistoryMode = 'push' | 'replace';

/** Harness screen route (the app is `/`). */
export const HARNESS_PATH = '/harness';

export function readConsoleNavSearch(): string {
  return window.location.search;
}

export function writeConsoleNavUrl(
  search: string,
  state: ConsoleNavState,
  mode: ConsoleNavHistoryMode
): void {
  const url = `${HARNESS_PATH}${search}${window.location.hash}`;
  const historyState = { ...window.history.state, consoleNav: state };
  if (mode === 'replace') window.history.replaceState(historyState, '', url);
  else window.history.pushState(historyState, '', url);
}

export function subscribeConsoleNavPopState(onPop: () => void): () => void {
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export function releaseConsoleFocus(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}
