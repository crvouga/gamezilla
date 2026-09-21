import type { ServerHttp } from '@libs/feature/public/sync';

type RnResponse = Response & { _bodyInit?: BodyInit | null };

async function bodyInitToText(
  init: BodyInit | null | undefined
): Promise<string | null> {
  if (init == null) return null;
  if (typeof init === 'string') return init;
  if (typeof ArrayBuffer !== 'undefined' && init instanceof ArrayBuffer) {
    return new TextDecoder().decode(init);
  }
  if (typeof Uint8Array !== 'undefined' && ArrayBuffer.isView(init)) {
    return new TextDecoder().decode(init as ArrayBufferView);
  }
  if (typeof Blob !== 'undefined' && init instanceof Blob) {
    return init.text();
  }
  return null;
}

/**
 * Materialize the body so the web client can read it.
 *
 * Prefer a string `_bodyInit` / decoded bytes over re-wrapping streams: RN's
 * whatwg-fetch often yields empty `text()` / `arrayBuffer()` for stream bodies,
 * and Hono may clone via `new Response(res.body, res)` wiping JSON when `body`
 * is missing. Always rebuild with a string so the client keeps a readable body.
 */
async function materializeResponse(res: Response): Promise<Response> {
  const rn = res as RnResponse;
  let text = await bodyInitToText(rn._bodyInit);
  if (text === null) {
    try {
      text = await res.clone().text();
    } catch {
      text = null;
    }
  }
  if (text === null || text.length === 0) {
    try {
      text = new TextDecoder().decode(await res.arrayBuffer());
    } catch {
      text = text ?? '';
    }
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
