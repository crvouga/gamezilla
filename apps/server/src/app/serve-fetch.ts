import type { ServerHttp } from '@apps/client/product/client-env';

/** Handler throw → 500 Response (in-process Hono as `ClientEnv.server`). */
export function serveFetch(
  handler: (request: Request) => Response | Promise<Response>
): ServerHttp {
  return async (input, init) => {
    try {
      const request =
        input instanceof Request && init === undefined
          ? input
          : new Request(input, init);
      return await handler(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(message, { status: 500 });
    }
  };
}
