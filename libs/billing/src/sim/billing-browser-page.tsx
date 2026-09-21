/** @jsxImportSource solid-js */
/**
 * The mock provider's hosted checkout and portal, as a page the sim actor's
 * browser renders when the app hands it a session link.
 */

import { SIM_SERVER_URL } from '@libs/feature/public/sim-constants';
import type { SimBrowserAppPage } from '@libs/sim-harness/composition';

import {
  MOCK_BILLING_SPA_CSS,
  MockBillingSessionPage,
} from '../public/mock-billing-page';

const BILLING_PAGES = /^\/api\/billing\/mock\/(checkout|portal)$/;

export const billingBrowserPage: SimBrowserAppPage = {
  name: 'billing',
  matches: (url) =>
    url.origin === SIM_SERVER_URL && BILLING_PAGES.test(url.pathname),
  css: MOCK_BILLING_SPA_CSS,
  render: (props) => (
    <MockBillingSessionPage
      fetch={props.fetch}
      navigate={props.navigate}
      url={props.url}
    />
  ),
};
