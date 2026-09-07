import type { ServerHttp } from '@apps/client/shell/client-env';
import type { PlaygroundLogBuffer } from '@pkgs/sim-console/client';

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method != null) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function requestPath(input: RequestInfo | URL): string {
  const href =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

/** Mirror client HTTP onto actor + server log buffers. */
export function loggingFetch(
  fetchFn: ServerHttp,
  logs: PlaygroundLogBuffer,
  serverLogs: PlaygroundLogBuffer,
  now: () => number
): ServerHttp {
  return async (input, init) => {
    const method = requestMethod(input, init);
    const path = requestPath(input);
    try {
      const res = await fetchFn(input, init);
      const entry = {
        at: now(),
        level: (res.ok ? 'info' : 'warn') as 'info' | 'warn',
        msg: `${method} ${path} → ${res.status}`,
      };
      logs.append(entry);
      serverLogs.append(entry);
      return res;
    } catch (err) {
      const entry = {
        at: now(),
        level: 'error' as const,
        msg: `${method} ${path} → error`,
        context: {
          error: err instanceof Error ? err.message : String(err),
        },
      };
      logs.append(entry);
      serverLogs.append(entry);
      throw err;
    }
  };
}
