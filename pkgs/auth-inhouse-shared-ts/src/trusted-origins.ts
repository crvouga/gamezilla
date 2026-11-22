/** The names one machine answers to as itself. */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const;

/**
 * A loopback http origin under every name of the same machine and port:
 * a stack that says `http://127.0.0.1:5400` is the page a person opens as
 * `http://localhost:5400`. Any other origin is itself alone.
 */
function withLoopbackNames(origin: string): readonly string[] {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return [origin];
  }
  if (
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.some((host) => host === url.hostname)
  )
    return [origin];
  const port = url.port === '' ? '' : `:${url.port}`;
  return LOOPBACK_HOSTS.map((host) => `http://${host}${port}`);
}

/**
 * Origins the IdP may redirect to after OAuth (native deep-link schemes +
 * web + API). A local stack's web origin is trusted under each loopback
 * name, since which one the browser shows is the person's choice.
 */
export function buildAuthTrustedOrigins(args: {
  readonly apiBaseURL: string;
  readonly clientWebOrigins?: readonly string[];
  /** Deep-link schemes of the native clients (`myapp` for `myapp://…`). */
  readonly clientSchemes: readonly string[];
}): string[] {
  const origins = new Set<string>([
    ...args.clientSchemes.flatMap((scheme) => [
      `${scheme}://`,
      `${scheme}://*`,
    ]),
    'exp://',
    'exp://**',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    args.apiBaseURL.replace(/\/$/, ''),
  ]);
  for (const origin of args.clientWebOrigins ?? []) {
    const trimmed = origin.trim().replace(/\/$/, '');
    if (trimmed.length === 0) continue;
    for (const named of withLoopbackNames(trimmed)) origins.add(named);
  }
  return [...origins];
}

/**
 * True when `callbackUrl` is allowed for an OAuth return (scheme or http(s)
 * origin match against {@link buildAuthTrustedOrigins} entries).
 */
export function isTrustedCallbackUrl(
  callbackUrl: string,
  trustedOrigins: readonly string[]
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return false;
  }
  const origin = parsed.origin;
  const href = parsed.href;
  for (const entry of trustedOrigins) {
    if (entry.endsWith('://**') || entry.endsWith('://*')) {
      const scheme = entry.slice(0, entry.indexOf('://') + 3);
      if (href.startsWith(scheme) || parsed.protocol === scheme) return true;
      continue;
    }
    if (entry.endsWith('://')) {
      if (parsed.protocol === entry || href.startsWith(entry)) return true;
      continue;
    }
    if (origin === entry || href.startsWith(`${entry}/`) || href === entry) {
      return true;
    }
  }
  return false;
}
