// @io-wall-ok — browser location / history adapter for console nav.
import {
  applyConsoleNavPatch,
  type ConsoleNavState,
  DEFAULT_CONSOLE_NAV,
} from '@sim/console/console-nav/console-nav';

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
  const bag = raw as Record<string, unknown>;
  const consoleNav = bag['consoleNav'] ?? bag['hostNav'];
  if (consoleNav === null || typeof consoleNav !== 'object') return null;
  return coerceHistoryNav(consoleNav);
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

function coerceHistoryNav(raw: unknown): ConsoleNavState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const h = raw as Record<string, unknown>;

  // Nested shape (current).
  if (
    typeof h['section'] === 'string' &&
    h['playground'] !== null &&
    typeof h['playground'] === 'object' &&
    h['reports'] !== null &&
    typeof h['reports'] === 'object'
  ) {
    return applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      section: h['section'] as ConsoleNavState['section'],
      playground: h['playground'] as ConsoleNavState['playground'],
      reports: h['reports'] as ConsoleNavState['reports'],
    });
  }

  // Flat legacy shape: { section, kind, instance, view }.
  if (typeof h['section'] === 'string' && typeof h['kind'] === 'string') {
    const instance =
      typeof h['instance'] === 'string'
        ? h['instance']
        : firstLegacyClientId(h['clientViews']);
    const view = typeof h['view'] === 'string' ? h['view'] : undefined;
    return applyConsoleNavPatch(DEFAULT_CONSOLE_NAV, {
      section: h['section'] as ConsoleNavState['section'],
      kind: h['kind'] as ConsoleNavState['playground']['kind'],
      instance,
      ...(view !== undefined ? { view } : {}),
    });
  }

  return null;
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
