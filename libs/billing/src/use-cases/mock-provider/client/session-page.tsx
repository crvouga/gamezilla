/**
 * The hosted pages for one session link (`…/checkout?accountId=…&returnUrl=…`
 * or `…/portal?…`). The browser entry mounts it over the page's own URL; a
 * simulated browser mounts it over the URL it loaded, with its own network and
 * navigation.
 */
import type { JSX } from 'solid-js';

import { createMockBillingApi, type MockBillingApi } from './api';
import { MockBillingApp, type MockBillingPage } from './app';

export type MockBillingSessionPageProps = {
  /** The session link. The pages sit directly under the mock base. */
  readonly url: string;
  readonly fetch: Parameters<typeof createMockBillingApi>[0]['fetch'];
  /** Load another document (the return link, "Subscribe"). */
  readonly navigate: (url: string) => void;
  readonly setTitle?: (title: string) => void;
};

type SessionLink = {
  readonly page: MockBillingPage;
  readonly accountId: string | null;
  readonly returnUrl: string;
  readonly checkoutUrl: string;
  readonly api: MockBillingApi;
};

function readSessionLink(props: MockBillingSessionPageProps): SessionLink {
  const url = new URL(props.url);
  const checkoutUrl = new URL(url);
  checkoutUrl.pathname = url.pathname.replace(/\/portal$/, '/checkout');
  const accountId = url.searchParams.get('accountId');
  return {
    page: url.pathname.endsWith('/checkout') ? 'checkout' : 'portal',
    accountId: accountId === null || accountId.length === 0 ? null : accountId,
    returnUrl: url.searchParams.get('returnUrl') ?? '',
    checkoutUrl: checkoutUrl.toString(),
    api: createMockBillingApi({
      fetch: props.fetch,
      baseUrl: new URL('./', url).toString(),
    }),
  };
}

export function MockBillingSessionPage(
  props: MockBillingSessionPageProps
): JSX.Element {
  // A session link is fixed for the page's lifetime; a new link is a new page.
  const link = readSessionLink(props);
  return (
    <MockBillingApp
      accountId={link.accountId}
      api={link.api}
      checkoutUrl={link.checkoutUrl}
      navigate={(target) => props.navigate(target)}
      page={link.page}
      returnUrl={link.returnUrl}
      setTitle={(title) => props.setTitle?.(title)}
    />
  );
}
