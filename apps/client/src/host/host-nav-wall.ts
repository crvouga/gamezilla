// @io-wall-ok — browser location / history adapter for host chrome nav.
import { coerceKind, type HostNavState } from '@apps/client/host/host-nav';

export type HostNavHistoryMode = 'push' | 'replace';

export function readHostNavSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

export function writeHostNavUrl(
  search: string,
  state: HostNavState,
  mode: HostNavHistoryMode
): void {
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  const historyState = { hostNav: state };
  if (mode === 'replace') {
    window.history.replaceState(historyState, '', url);
  } else {
    window.history.pushState(historyState, '', url);
  }
}

export function readHostNavFromPopState(
  event: PopStateEvent
): HostNavState | null {
  const raw = event.state;
  if (raw === null || typeof raw !== 'object') return null;
  const hostNav = (raw as { hostNav?: unknown }).hostNav;
  if (hostNav === null || typeof hostNav !== 'object') return null;
  const h = hostNav as Partial<HostNavState> & {
    readonly clientViews?: unknown;
  };
  if (
    typeof h.host !== 'string' ||
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
    host: h.host as HostNavState['host'],
    section: h.section as HostNavState['section'],
    kind: coerceKind(h.kind),
    instance,
    view: h.view as HostNavState['view'],
  };
}

export function subscribeHostNavPopState(
  onPop: (event: PopStateEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export function isHostNavWeb(): boolean {
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
