import type { ServerHttp } from '@apps/client/product/client-env';

type RnResponse = Response & { _bodyInit?: BodyInit | null };

/**
 * Materialize the body so React Native / Expo Go can read it.
 *
 * Prefer a string `_bodyInit` / decoded bytes over re-wrapping streams: RN's
 * whatwg-fetch often yields empty `text()` / `arrayBuffer()` for stream bodies.
 * Always rebuild with a string so the client polyfill keeps a readable body.
 */
async function materializeResponse(res: Response): Promise<Response> {
  const rn = res as RnResponse;
  let text: string;
  if (typeof rn._bodyInit === 'string') {
    text = rn._bodyInit;
  } else {
    const buf = await res.arrayBuffer();
    text = new TextDecoder().decode(buf);
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

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
      return await materializeResponse(await handler(request));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(message, { status: 500 });
    }
  };
}
