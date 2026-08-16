// @io-wall-ok — browser location / history adapter for host chrome nav.
import type { HostNavState } from '@apps/client/host/host-nav';

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

function isClientViews(
  value: unknown
): value is Readonly<Record<string, string>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'string') return false;
  }
  return true;
}

export function readHostNavFromPopState(
  event: PopStateEvent
): HostNavState | null {
  const raw = event.state;
  if (raw === null || typeof raw !== 'object') return null;
  const hostNav = (raw as { hostNav?: unknown }).hostNav;
  if (hostNav === null || typeof hostNav !== 'object') return null;
  const h = hostNav as Partial<HostNavState>;
  if (
    typeof h.host !== 'string' ||
    typeof h.section !== 'string' ||
    typeof h.kind !== 'string' ||
    typeof h.view !== 'string'
  ) {
    return null;
  }
  const clientViews = isClientViews(h.clientViews) ? h.clientViews : {};
  return {
    host: h.host as HostNavState['host'],
    section: h.section as HostNavState['section'],
    kind: h.kind as HostNavState['kind'],
    view: h.view,
    clientViews,
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
