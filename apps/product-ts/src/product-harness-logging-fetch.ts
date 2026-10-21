import { requestMethod, requestPath } from '@libs/harness-ts/http-request';
import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import type { ProductHarnessLogBuffer } from '@pkgs/harness-console-shared-ts/ports';

/**
 * Mirror client HTTP onto the actor log and the balancer's ingress access log.
 * Which instance served a request is recorded separately, from the balancer's
 * own route feed (see `bindLoadBalancerRouteLogs`).
 */
export function loggingFetch(
  fetchFn: ServerHttp,
  logs: ProductHarnessLogBuffer,
  ingressLogs: ProductHarnessLogBuffer,
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
      ingressLogs.append(entry);
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
      ingressLogs.append(entry);
      throw err;
    }
  };
}
