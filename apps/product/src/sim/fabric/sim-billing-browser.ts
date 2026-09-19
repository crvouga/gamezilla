/**
 * The sim's browser half for the fake provider's mock pages. `subscribeToPlus`
 * and the portal actions leave the app through `openExternalUrl`, and this
 * walks the mock page headlessly — pressing the button the queued intent names,
 * exactly the way the bun-webview host taps it with a live browser.
 */
import type { ServerHttp } from '@apps/client/shell/client-env';
import { MOCK_BILLING_TEST_IDS } from '@libs/billing/public/mock-test-ids';
import type { OpenExternalUrl } from '@pkgs/ui';

import { walkMockPage } from './mock-page-walk';

export type SimPortalIntent =
  | { readonly kind: 'none' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'switch_price'; readonly priceKey: string };

export type SimBillingBrowser = {
  readonly openExternalUrl: OpenExternalUrl;
  readonly queuePortalIntent: (intent: SimPortalIntent) => void;
};

function buttonTestIdFor(intent: SimPortalIntent): string | undefined {
  switch (intent.kind) {
    case 'cancel':
      return MOCK_BILLING_TEST_IDS.portalCancel;
    case 'resume':
      return MOCK_BILLING_TEST_IDS.portalResume;
    case 'switch_price':
      return MOCK_BILLING_TEST_IDS.portalSwitch(intent.priceKey);
    case 'none':
      return undefined;
  }
}

export function createSimBillingBrowser(args: {
  readonly browserFetch: ServerHttp;
  readonly apiOrigin: string;
}): SimBillingBrowser {
  const mockBase = `${args.apiOrigin}/api/billing/mock/`;
  let pending: SimPortalIntent = { kind: 'none' };

  const openExternalUrl: OpenExternalUrl = async (url) => {
    const intent = pending;
    pending = { kind: 'none' };
    if (!url.startsWith(mockBase)) return;
    if (url.includes('/checkout')) {
      // No intent needed: the checkout page has one action — pay.
      await walkMockPage({
        fetch: args.browserFetch,
        startUrl: url,
        appOrigin: args.apiOrigin,
      });
      return;
    }
    const buttonTestId = buttonTestIdFor(intent);
    if (buttonTestId === undefined) {
      // A bare portal visit shows the page and presses nothing, like a browser.
      await args.browserFetch(url, { method: 'GET', redirect: 'manual' });
      return;
    }
    await walkMockPage({
      fetch: args.browserFetch,
      startUrl: url,
      appOrigin: args.apiOrigin,
      buttonTestId,
    });
  };

  return {
    openExternalUrl,
    queuePortalIntent: (intent) => {
      pending = intent;
    },
  };
}
