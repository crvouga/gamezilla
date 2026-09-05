// @io-wall-ok — RN / Expo Response.body is missing or wrong; Hono clones via res.body and wipes JSON.

/**
 * React Native's whatwg-fetch Response exposes `_bodyInit` but not a reliable
 * `.body`. Hono’s `c.res` setter / finalized `c.header()` do
 * `new Response(res.body, res)` — with `body === undefined` that yields status
 * 200 and an empty body (`auth/anon/ensure` / `auth/refresh` empty success body).
 *
 * Always surface `_bodyInit` when the platform `body` getter is nullish so Hono
 * preserves JSON on clone. Keep a working stream body when the platform has one.
 */
export function polyfillResponseBodyFromInit(): void {
  if (typeof Response === 'undefined') return;

  const proto = Response.prototype as unknown as {
    body?: unknown;
    _bodyInit?: BodyInit | null;
  };
  const existing = Object.getOwnPropertyDescriptor(proto, 'body');
  if (existing !== undefined && existing.configurable === false) return;

  try {
    Object.defineProperty(proto, 'body', {
      configurable: true,
      enumerable: true,
      get(this: { _bodyInit?: BodyInit | null }): BodyInit | null {
        if (existing?.get !== undefined) {
          try {
            const value = existing.get.call(this) as
              | BodyInit
              | null
              | undefined;
            if (value != null) return value;
          } catch {
            // fall through to _bodyInit
          }
        } else if (existing?.value != null) {
          return existing.value as BodyInit;
        }
        return this._bodyInit ?? null;
      },
    });
  } catch {
    // Non-configurable prototype (some runtimes) — leave alone.
  }
}
