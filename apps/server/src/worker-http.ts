import type { ApiWorkerEnv } from '@libs/app-root-shared/env';
import { readDeploymentProtection } from '@libs/app-root-shared/env';
import type { ExecutionContext } from '@libs/app-root-shared/worker-handler';
import { runHttpInvocation } from '@pkgs/http-client-shared/run-http-invocation';
import type { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';

/** Keep background ownership checks on the platform lifetime, after the reply. */
export function runWorkerHttp<T>(
  http: ReturnType<typeof createScopedHttpClient>,
  env: ApiWorkerEnv,
  ctx: ExecutionContext,
  invoke: (ctx: ExecutionContext) => Promise<T>
): Promise<T> {
  if (readDeploymentProtection(env) === 'production') return invoke(ctx);
  const foreground = Promise.withResolvers<T>();
  let hasBackground = false;
  const completion = runHttpInvocation(http, async (waitUntil) => {
    try {
      const result = await invoke({
        waitUntil(work) {
          hasBackground = true;
          waitUntil(work);
          // An error before the reply still fails the foreground invocation.
          void work.catch(foreground.reject);
        },
        passThroughOnException: () => ctx.passThroughOnException(),
      });
      if (result instanceof Response && result.status >= 500) {
        await result.body?.cancel();
        throw new Error(
          `Worker returned HTTP ${result.status} in a standard environment`
        );
      }
      if (hasBackground) foreground.resolve(result);
      return result;
    } catch (error) {
      foreground.reject(error);
      throw error;
    }
  });
  // The join still reports every background failure and unread HTTP body.
  ctx.waitUntil(completion);
  void completion.then(foreground.resolve, foreground.reject);
  return foreground.promise;
}
