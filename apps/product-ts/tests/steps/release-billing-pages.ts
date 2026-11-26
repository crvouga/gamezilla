import { registerBillingPages } from '@libs/billing-harness-ts/provider-pages.steps';
import { viewBillingPlans } from '@libs/runtime-harness-ts/billing-gestures';
import {
  expectVisible,
  JOURNEY_WAIT_MS,
  tap,
} from '@libs/runtime-harness-ts/journey-gestures';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { LiveWorld } from './live-world';

const checkoutCard = 'stripe-mock-card';
const cancelCheckout = 'stripe-mock-cancel';
const portalReturn = 'stripe-mock-portal-return';

async function showAction(w: LiveWorld, button: string): Promise<void> {
  await w.journey.act('billing action available', (ui) =>
    ui.get(button).wait('enabled', { timeoutMs: JOURNEY_WAIT_MS })
  );
  await w
    .hostView()
    .evaluate(
      `document.querySelector('[data-testid="${button}"]').scrollIntoView({block: 'center'})`
    );
}

// Run in the disposable tab. The real API and simulated provider still handle
// the POST. Only delivery of this one response waits for the pending-state capture.
function holdResponse(url: string, release: string): void {
  const tab: Window = window;
  const fetchResponse = tab.fetch.bind(tab);
  const released = new Promise<void>((resolve) =>
    window.addEventListener(release, () => resolve(), { once: true })
  );
  tab.fetch = async (...args) => {
    const response = await fetchResponse(...args);
    if (response.url === url) {
      tab.fetch = fetchResponse;
      await released;
    }
    return response;
  };
}

const releaseResponse = 'release-billing-provider-response';
const canLeave =
  "window.dispatchEvent(new Event('beforeunload', { cancelable: true }))";

async function choose(
  w: LiveWorld,
  action: 'checkout' | 'portal'
): Promise<void> {
  const view = w.hostView();
  if ((await view.evaluate(canLeave)) !== true)
    throw new Error('The app already has pending work');
  const url = new URL(`/api/billing/${action}`, w.origins.api).href;
  await view.evaluate(
    `(${holdResponse.toString()})(${JSON.stringify(url)}, ${JSON.stringify(releaseResponse)})`
  );
  const button =
    action === 'checkout' ? Handles.billingSubscribe : Handles.billingManage;
  await w.journey.act('choose the billing action', (ui) => tap(ui, button));
  if ((await view.evaluate(canLeave)) !== false)
    throw new Error(`The pending ${action} did not guard departure`);
}

async function arrive(
  w: LiveWorld,
  origin: string,
  control: string
): Promise<void> {
  const browser = w.journey.browser;
  if (!browser) throw new Error('The billing handoff needs a browser');
  await w
    .hostView()
    .evaluate(
      `window.dispatchEvent(new Event(${JSON.stringify(releaseResponse)}))`
    );
  await browser.waitForNavigation(
    (url) => new URL(url).origin === origin,
    JOURNEY_WAIT_MS
  );
  await w.journey.act('see the provider page', (ui) =>
    expectVisible(ui, control)
  );
}

/** Registered only by the isolated release runner, using its simulated Stripe origin. */
export function registerReleaseBillingPages(providerOrigin: string): void {
  registerBillingPages<LiveWorld>({
    showPlans: async (w) => {
      await w.journey.open('signed-in');
      await w.journey.act('open billing plans', viewBillingPlans);
      await showAction(w, Handles.billingSubscribe);
    },
    leaveCheckout: async (w) => {
      await choose(w, 'checkout');
      await arrive(w, providerOrigin, checkoutCard);
      await w.journey.act('leave checkout', (ui) => tap(ui, cancelCheckout));
      await showAction(w, Handles.billingManage);
    },
    openCheckout: (w) => choose(w, 'checkout'),
    seeCheckout: (w) => arrive(w, providerOrigin, checkoutCard),
    openPortal: (w) => choose(w, 'portal'),
    seePortal: (w) => arrive(w, providerOrigin, portalReturn),
  });
}
