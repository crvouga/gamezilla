// @io-wall-ok — RN Response.body is missing; Hono clones via res.body and wipes JSON.

/**
 * React Native's whatwg-fetch Response exposes `_bodyInit` but not `.body`.
 * Hono’s `c.res` setter / finalized `c.header()` do
 * `new Response(res.body, res)` — with `body === undefined` that yields status
 * 200 and an empty body (`auth/anon/ensure empty/non-object body`).
 *
 * When `.body` is missing/undefined, surface `_bodyInit` so Hono preserves it.
 * Skip when a real ReadableStream body already exists (web / Bun).
 */
export function polyfillResponseBodyFromInit(): void {
  if (typeof Response === 'undefined') return;

  let probeBody: unknown;
  try {
    probeBody = new Response('x').body;
  } catch {
    return;
  }
  if (probeBody != null) return;

  const proto = Response.prototype as unknown as {
    body?: unknown;
    _bodyInit?: BodyInit | null;
  };
  if (Object.getOwnPropertyDescriptor(proto, 'body') !== undefined) return;

  try {
    Object.defineProperty(proto, 'body', {
      configurable: true,
      enumerable: true,
      get(this: { _bodyInit?: BodyInit | null }): BodyInit | null {
        return this._bodyInit ?? null;
      },
    });
  } catch {
    // Non-configurable prototype (some runtimes) — leave alone.
  }
}
