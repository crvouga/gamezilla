import type { ApiWorkerEnv } from '@libs/app-root-shared/env';
import { readDeploymentProtection } from '@libs/app-root-shared/env';
import type { ExecutionContext } from '@libs/app-root-shared/worker-handler';
import { runHttpInvocation } from '@pkgs/http-client-shared/run-http-invocation';
import type { createScopedHttpClient } from '@pkgs/http-client-shared/scoped-http-client';

/** Standard deployments and localhost must report invocation leaks as failures. */
export function runWorkerHttp<T>(
  http: ReturnType<typeof createScopedHttpClient>,
  env: ApiWorkerEnv,
  ctx: ExecutionContext,
  invoke: (ctx: ExecutionContext) => Promise<T>
): Promise<T> {
  if (readDeploymentProtection(env) === 'production') return invoke(ctx);
  return runHttpInvocation(http, async (waitUntil) => {
    const result = await invoke({
      waitUntil,
      passThroughOnException: () => ctx.passThroughOnException(),
    });
    if (result instanceof Response && result.status >= 500) {
      await result.body?.cancel();
      throw new Error(
        `Worker returned HTTP ${result.status} in a standard environment`
      );
    }
    return result;
  });
}
