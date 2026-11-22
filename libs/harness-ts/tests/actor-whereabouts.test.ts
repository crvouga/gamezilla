import { expect, test } from 'bun:test';
import {
  describeWhereabouts,
  innermostScreen,
} from '@libs/harness-ts/actor-whereabouts';
import type { BrowserNavigation } from '@libs/harness-ts/browser-navigation';

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
