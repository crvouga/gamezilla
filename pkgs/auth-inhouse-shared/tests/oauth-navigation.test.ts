import { expect, test } from 'bun:test';
import { oauthNavigation } from '@pkgs/auth-inhouse-shared/oauth-navigation';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const REQUEST = 'https://api.example.invalid/auth/callback/google';

// regression: oauth-document-handoff-not-followed
test('a document refresh preserves the complete callback query and starts a GET', () => {
  const target =
    'https://app.example.invalid/sso-callback?code=accepted&next=%2Fsettings';
  const response = new Response('<a>Return to the app</a>', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      refresh: `0;url=${target}`,
    },
  });
  expect(oauthNavigation(response, REQUEST)).toEqual({
    url: new URL(target),
    preserveMethod: false,
  });
});

test('callback codes survive document navigation and redirect methods match browser semantics', async () => {
  await assertProperty(
    'oauth-navigation-callback-code',
    fc.property(
      fc.string(),
      fc.constantFrom(200, 302, 303, 307, 308),
      (code, status) => {
        const target = new URL('/sso-callback', 'https://app.example.invalid');
        target.searchParams.set('code', code);
        const response = new Response(null, {
          status,
          headers:
            status === 200
              ? { 'content-type': 'text/html', refresh: `0;url=${target.href}` }
              : { location: target.href },
        });
        const hop = oauthNavigation(response, REQUEST);
        expect(hop?.url.searchParams.get('code')).toBe(code);
        expect(hop?.preserveMethod).toBe(status === 307 || status === 308);
      }
    )
  );
});

test('an error page, delayed refresh or non-HTML response cannot finish a handoff', () => {
  for (const response of [
    new Response(null, {
      status: 500,
      headers: { 'content-type': 'text/html', refresh: '0;url=/sso-callback' },
    }),
    new Response(null, {
      headers: { 'content-type': 'text/html', refresh: '5;url=/sso-callback' },
    }),
    new Response(null, {
      headers: {
        'content-type': 'application/json',
        refresh: '0;url=/sso-callback',
      },
    }),
  ])
    expect(oauthNavigation(response, REQUEST)).toBeNull();
});
