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

// Observe the app's own guard while its real provider request is pending.
// A synthetic cancelable event exercises listeners without navigating the tab.
function observePendingDeparture(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const pending = () =>
      !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
    if (pending()) throw new Error('The app already has pending work');
    const deadline = AbortSignal.timeout(timeoutMs);
    const observer = new MutationObserver(() => {
      if (!pending()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    deadline.onabort = () => {
      observer.disconnect();
      reject(new Error('The billing action did not guard pending work'));
    };
    window.addEventListener(
      'pagehide',
      () =>
        reject(
          new Error('Billing left before its pending-work guard was observed')
        ),
      { once: true }
    );
  });
}

async function openProvider(
  w: LiveWorld,
  button: string,
  origin: string
): Promise<void> {
  const browser = w.journey.browser;
  if (!browser) throw new Error('The billing handoff needs a browser');
  await Promise.all([
    w
      .hostView()
      .evaluate(`(${observePendingDeparture.toString()})(${JOURNEY_WAIT_MS})`),
    w.journey.act('choose the billing action', (ui) => tap(ui, button)),
  ]);
  await browser.waitForNavigation(
    (url) => new URL(url).origin === origin,
    JOURNEY_WAIT_MS
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
      await openProvider(w, Handles.billingSubscribe, providerOrigin);
      await w.journey.act('leave checkout', (ui) => tap(ui, cancelCheckout));
      await showAction(w, Handles.billingManage);
    },
    openCheckout: (w) =>
      openProvider(w, Handles.billingSubscribe, providerOrigin),
    seeCheckout: (w) =>
      w.journey.act('see the checkout form', (ui) =>
        expectVisible(ui, checkoutCard)
      ),
    openPortal: (w) => openProvider(w, Handles.billingManage, providerOrigin),
    seePortal: (w) =>
      w.journey.act('see the portal return action', (ui) =>
        expectVisible(ui, portalReturn)
      ),
  });
}
