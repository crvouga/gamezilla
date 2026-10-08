export type RouteParams = Readonly<Record<string, string>>;

export type ListRoute = {
  readonly view: 'list';
  readonly params: RouteParams;
};

export type TestRoute = {
  readonly view: 'test';
  readonly testId: string;
  readonly params: RouteParams;
};

export type Route = ListRoute | TestRoute;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.split('?');
  const parts = (q[0] ?? '').split('/').filter(Boolean);
  const params: Record<string, string> = {};
  for (const kv of (q[1] ?? '').split('&')) {
    if (!kv) continue;
    const i = kv.indexOf('=');
    const key = decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i));
    const value = decodeURIComponent(i < 0 ? '' : kv.slice(i + 1));
    params[key] = value;
  }
  if (parts[0] === 'test' && parts[1]) {
    // `buildHash` encodes the id; an aggregated report's ids carry slashes
    // (`libs/chess/monkey`), so the encoded form must be read back.
    return { view: 'test', testId: decodeURIComponent(parts[1]), params };
  }
  return { view: 'list', params };
}

export function buildHash(route: Route): string {
  const qs = Object.keys(route.params)
    .filter((k) => {
      const v = route.params[k];
      return v !== undefined && v !== null && v !== '';
    })
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(route.params[k] ?? '')}`
    )
    .join('&');
  const path =
    route.view === 'test' ? `/test/${encodeURIComponent(route.testId)}` : '/';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function viewMode(route: Route): 'single' | 'multi' {
  return route.params['view'] === 'single' ? 'single' : 'multi';
}

export function zoomMode(route: Route): string {
  return route.params['zoom'] || 'fit';
}

export function showAside(route: Route): boolean {
  return route.params['aside'] !== '0';
}

export function showPress(route: Route): boolean {
  return route.params['press'] !== '0';
}
