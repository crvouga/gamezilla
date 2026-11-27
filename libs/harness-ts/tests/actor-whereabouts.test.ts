import { expect, test } from 'bun:test';
import {
  describeWhereabouts,
  innermostScreen,
} from '@libs/harness-ts/actor-whereabouts';
import type { BrowserNavigation } from '@libs/harness-ts/browser-navigation';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const at = (url: string): BrowserNavigation => ({
  currentUrl: async () => url,
  waitForNavigation: async () => url,
});

test('the innermost declared screen names where the page is', () => {
  expect(
    innermostScreen(
      '<main data-screen="tabs"><section data-screen="billing"></section></main>'
    )
  ).toBe('billing');
  expect(innermostScreen('<main></main>')).toBeNull();
  expect(innermostScreen(null)).toBeNull();
});

test('an app page reads as its path and screen, never its query', async () => {
  expect(
    await describeWhereabouts({
      browser: at('http://127.0.0.1:4000/billing?code=secret'),
      appOrigin: 'http://127.0.0.1:4000',
      html: async () => '<div data-screen="billing"></div>',
    })
  ).toBe('/billing (screen: billing)');
});

test("another origin's page keeps its origin so a provider page is recognisable", async () => {
  expect(
    await describeWhereabouts({
      browser: at('http://127.0.0.1:5000/checkout/cs_1?session=secret'),
      appOrigin: 'http://127.0.0.1:4000',
      html: async () => '<form></form>',
    })
  ).toBe('http://127.0.0.1:5000/checkout/cs_1 (screen: none)');
});

test('an unreadable page still yields a description', async () => {
  expect(
    await describeWhereabouts({
      browser: {
        currentUrl: async () => {
          throw new Error('navigating');
        },
        waitForNavigation: async () => '',
      },
      appOrigin: null,
      html: async () => {
        throw new Error('detached');
      },
    })
  ).toBe('an unreadable page (screen: none)');
});

test.each([
  [
    '<style>.startup-shell-failed {}</style><div data-startup-shell></div>',
    'startup shell loading',
  ],
  ['<section data-testid="boot-loading"></section>', 'app boot loading'],
  [
    '<div data-component="LocalDatabaseBootErrorScreen"></div>',
    'local database boot error',
  ],
  ['<div data-component="ErrorState"></div>', 'error screen'],
])(
  'boot diagnostics identify only the structural state of %s',
  async (html, state) => {
    expect(
      await describeWhereabouts({
        browser: at('data:text/html,private-content'),
        appOrigin: null,
        html: async () => html,
      })
    ).toBe(`data: (${state})`);
  }
);

test('a stalled snapshot still reports the location at the diagnostic deadline', async () => {
  const { clock, timers } = createHarnessClock();
  const location = describeWhereabouts({
    browser: at('http://app.test/?code=secret'),
    appOrigin: null,
    html: () => new Promise(() => {}),
    timers,
  });
  await Promise.resolve();
  clock.advance(1000);
  expect(await location).toBe('http://app.test/ (diagnosis timed out)');
  expect(clock.pendingOneShotCount()).toBe(0);
});
