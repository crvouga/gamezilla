/**
 * End the provider's form-navigation chain before crossing to the app origin.
 * Refresh is handled after this HTML document loads, unlike an HTTP redirect.
 */
export function oauthCallbackResponse(
  target: URL,
  requestUrl: string
): Response {
  if (
    target.origin === new URL(requestUrl).origin ||
    (target.protocol !== 'http:' && target.protocol !== 'https:')
  ) {
    return new Response(null, {
      status: 302,
      headers: {
        location: target.href,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  }
  const href = escapeAttribute(target.href);
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Returning to the app</title></head><body><a href="${href}">Return to the app</a></body></html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        refresh: `0;url=${target.href}`,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'content-security-policy':
          "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      },
    }
  );
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;');
}
