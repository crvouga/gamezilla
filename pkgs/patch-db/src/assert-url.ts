import { assert } from '@pkgs/assert';

/**
 * Invariant: sync base URL must be an absolute http(s) URL.
 *
 * If the value is hostname-only (no scheme), the WHATWG URL implementation in fetch() resolves
 * paths against the current document origin — on web that produces broken URLs like
 * `https://<cloudfront>/<apprunner-host>/patch-db/...`.
 *
 * Include the wire base path in the URL (default `/patch-db`), e.g. `https://host/patch-db`.
 */
export function assertUrl(baseUrl: string): asserts baseUrl is string {
  assert.string(baseUrl, 'API URL must be a string');
  assert.ok(
    baseUrl.length > 0,
    'API URL must be non-empty (hostname-only values break web fetch resolution)',
    { baseUrl }
  );

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    assert.ok(
      false,
      'API URL must be an absolute URL with a scheme (e.g. https://…). A bare hostname is treated as a path on the web app origin.',
      { baseUrl, error }
    );
  }

  assert.ok(
    parsed.protocol === 'http:' || parsed.protocol === 'https:',
    'API URL must use http:// or https://',
    { baseUrl, protocol: parsed.protocol }
  );
  assert.ok(parsed.host.length > 0, 'API URL must include a non-empty host', {
    baseUrl,
  });
}
