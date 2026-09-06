/** Route targets: a path string or `{ pathname, params }` with `[key]` tokens. */

export type Href = string;

export type HrefObject = {
  readonly pathname: string;
  readonly params?: Record<string, string | undefined>;
};

function applyParamsToPath(
  pathname: string,
  params: Record<string, string | undefined> | undefined
): string {
  let path = pathname;
  const unused: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    const token = `[${key}]`;
    if (path.includes(token)) {
      path = path.split(token).join(encodeURIComponent(value));
    } else {
      unused[key] = value;
    }
  }
  const qs = Object.entries(unused)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (qs.length === 0) return path;
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

export function hrefToPath(href: Href | HrefObject): string {
  if (typeof href === 'string') return href;
  return applyParamsToPath(href.pathname, href.params);
}

export function normalizePath(path: string): string {
  if (path === '' || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}
