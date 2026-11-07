import { expect, test } from 'bun:test';
import { expectGoogleHandOff } from '@libs/runtime-harness-ts/anonymous-gestures';

const CALLBACK = 'http://127.0.0.1:34305';
const GOOGLE = 'http://127.0.0.1:34307';
function request(origin = GOOGLE): URL {
  const url = new URL('/o/oauth2/v2/auth', origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', 'native-stack-google-handoff');
  url.searchParams.set('redirect_uri', `${CALLBACK}/api/auth/callback/google`);
  return url;
}
function observed(url: string, expectedOrigin = GOOGLE) {
  return {
    oauthCallbackOrigin: CALLBACK,
    googleAuthorizationOrigin: expectedOrigin,
    waitForNavigation: async (match: (href: string) => boolean) => {
      if (!match(url))
        throw new Error(
          'Observed navigation does not reach the configured Google provider'
        );
      return url;
    },
  };
}

// regression: native-stack-google-handoff-unverifiable
test('native stack Google handoff reaches its configured provider with the exact way back', async () => {
  await expectGoogleHandOff(observed(request().href));
});

test('live Google handoff retains its strict production origin', async () => {
  await expectGoogleHandOff(
    observed(
      request('https://accounts.google.com').href,
      'https://accounts.google.com'
    )
  );
  await expect(
    expectGoogleHandOff(observed(request().href, 'https://accounts.google.com'))
  ).rejects.toThrow();
});

test.each([
  'http://127.0.0.1:34308',
  CALLBACK,
  'https://accounts.google.com.evil.example',
  'http://accounts.google.com',
])('handoff refuses an unexpected provider boundary %s', async (origin) => {
  await expect(
    expectGoogleHandOff(observed(request(origin).href))
  ).rejects.toThrow();
});

test.each([
  ['response_type', 'token'],
  ['state', ''],
  ['redirect_uri', `${CALLBACK}/wrong-callback`],
  ['redirect_uri', 'http://127.0.0.1:34306/api/auth/callback/google'],
] as const)('handoff refuses a wrong %s', async (key, value) => {
  const url = request();
  url.searchParams.set(key, value);
  await expect(expectGoogleHandOff(observed(url.href))).rejects.toThrow();
});

test('Google chooser continue links must stay inside the trusted provider boundary', async () => {
  const chooser = new URL('/chooser', GOOGLE);
  chooser.searchParams.set('continue', request().href);
  await expectGoogleHandOff(observed(chooser.href));
  chooser.searchParams.set('continue', request(CALLBACK).href);
  await expect(expectGoogleHandOff(observed(chooser.href))).rejects.toThrow();
});
