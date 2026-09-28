/** @jsxImportSource solid-js */
/**
 * The payment provider's hosted checkout and portal, as a page the harness
 * actor's browser renders when the app hands it a session link. The pages are
 * the provider's own: they talk to the provider's origin, never the app's.
 */
import { isHarnessBillingOrigin } from '@libs/feature/public/harness-constants';
import type { HarnessBrowserAppPage } from '@libs/harness/composition';
import { MockBillingEmbeddedPage } from '@pkgs/billing-mock-provider/embedded';
import { MOCK_BILLING_SPA_CSS } from '@pkgs/billing-mock-provider/server/assets.generated';

const HOSTED_PAGES = /^\/(c\/pay|p\/session)\/[^/]+$/;

export const billingBrowserPage: HarnessBrowserAppPage = {
  name: 'billing',
  matches: (url) =>
    isHarnessBillingOrigin(url.origin) && HOSTED_PAGES.test(url.pathname),
  css: MOCK_BILLING_SPA_CSS,
  render: (props) => (
    <MockBillingEmbeddedPage
      fetch={props.fetch}
      navigate={props.navigate}
      url={props.url}
    />
  ),
};
