import { expect, test } from 'bun:test';
import { harnessJourneyBrowser } from '@libs/runtime-harness-ts/harness-journey-browser';

// regression: native-stack-google-handoff-unverifiable
test('a native stack exposes browser observation with trusted provider and callback origins', async () => {
  const href = 'http://127.0.0.1:34307/o/oauth2/v2/auth';
  const seen: string[] = [];
  const browser = harnessJourneyBrowser({
    http: {
      kind: 'stack',
      origin: 'http://127.0.0.1:34305',
      idpOrigins: {
        google: 'http://127.0.0.1:34307',
        apple: 'http://127.0.0.1:34309',
      },
      accountTag: 'literal-native-stack',
    },
    navigation: {
      currentUrl: async () => href,
      waitForNavigation: async (match) => {
        seen.push(href);
        if (!match(href)) throw new Error('wrong destination');
        return href;
      },
    },
  });
  expect(browser).not.toBeNull();
  expect(browser?.googleAuthorizationOrigin).toBe('http://127.0.0.1:34307');
  expect(browser?.oauthCallbackOrigin).toBe('http://127.0.0.1:34305');
  expect(await browser?.waitForNavigation((url) => url === href, 20_000)).toBe(
    href
  );
  expect(seen).toEqual([href]);
});

test('in-process actors do not claim native browser navigation', () => {
  expect(
    harnessJourneyBrowser({
      http: { kind: 'in-process' },
      navigation: undefined,
    })
  ).toBeNull();
});
