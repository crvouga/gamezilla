// @io-wall-ok — browser location / history adapter for console nav.
import {
  type ConsoleNavState,
  coerceKind,
} from '@apps/system/console-nav/console-nav';

export type ConsoleNavHistoryMode = 'push' | 'replace';

export function readConsoleNavSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

export function writeConsoleNavUrl(
  search: string,
  state: ConsoleNavState,
  mode: ConsoleNavHistoryMode
): void {
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  const historyState = { consoleNav: state };
  if (mode === 'replace') {
    window.history.replaceState(historyState, '', url);
  } else {
    window.history.pushState(historyState, '', url);
  }
}

export function readConsoleNavFromPopState(
  event: PopStateEvent
): ConsoleNavState | null {
  const raw = event.state;
  if (raw === null || typeof raw !== 'object') return null;
  const consoleNav =
    (raw as { consoleNav?: unknown; hostNav?: unknown }).consoleNav ??
    (raw as { hostNav?: unknown }).hostNav;
  if (consoleNav === null || typeof consoleNav !== 'object') return null;
  const h = consoleNav as Partial<ConsoleNavState> & {
    readonly clientViews?: unknown;
  };
  if (
    typeof h.section !== 'string' ||
    typeof h.kind !== 'string' ||
    typeof h.view !== 'string'
  ) {
    return null;
  }
  const instance =
    typeof h.instance === 'string'
      ? h.instance
      : firstLegacyClientId(h.clientViews);
  return {
    section: h.section as ConsoleNavState['section'],
    kind: coerceKind(h.kind),
    instance,
    view: h.view as ConsoleNavState['view'],
  };
}

export function subscribeConsoleNavPopState(
  onPop: (event: PopStateEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export function isConsoleNavWeb(): boolean {
  return typeof window !== 'undefined';
}

function firstLegacyClientId(clientViews: unknown): string {
  if (
    clientViews === null ||
    typeof clientViews !== 'object' ||
    Array.isArray(clientViews)
  ) {
    return '';
  }
  const keys = Object.keys(clientViews as Record<string, unknown>).sort();
  return keys[0] ?? '';
}
