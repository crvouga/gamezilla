import { expect, test } from 'bun:test';
import { createBrowserNavigation } from '@libs/harness-ts/browser-navigation';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

test('native URL observation includes the actual provider origin and query', async () => {
  const time = createHarnessClock();
  const href = 'http://127.0.0.1:34307/o/oauth2/v2/auth?state=literal';
  const navigation = createBrowserNavigation({
    readUrl: async () => href,
    ...time,
  });
  expect(await navigation.currentUrl()).toBe(href);
  expect(
    await navigation.waitForNavigation((url) => url === href, 20_000)
  ).toBe(href);
});

test('navigation observation keeps its existing deadline without issuing gestures', async () => {
  const time = createHarnessClock();
  const navigation = createBrowserNavigation({
    readUrl: async () => 'http://app.test/',
    ...time,
  });
  const waiting = navigation.waitForNavigation(() => false, 250);
  const result = waiting.then(
    () => null,
    (error: unknown) => error
  );
  await Promise.resolve();
  time.clock.advance(250);
  const error = await result;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain(
    'no matching navigation within 250ms'
  );
});
