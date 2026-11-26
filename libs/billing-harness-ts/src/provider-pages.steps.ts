import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';

type BillingPages<W> = {
  showPlans: (w: W) => Promise<void>;
  leaveCheckout: (w: W) => Promise<void>;
  openCheckout: (w: W) => Promise<void>;
  seeCheckout: (w: W) => Promise<void>;
  openPortal: (w: W) => Promise<void>;
  seePortal: (w: W) => Promise<void>;
};

/** The same billing actions and outcomes on the harness and disposable release stack. */
export function registerBillingPages<W>(pages: BillingPages<W>): void {
  const { Given, When, Then } = stepsFor<W>();
  Given('Alice is signed in and looking at the billing plans', pages.showPlans);
  Given(
    'Alice is back at the billing plans after leaving checkout without paying',
    async (w) => {
      await pages.showPlans(w);
      await pages.leaveCheckout(w);
    }
  );
  When('Alice chooses to start the free trial', pages.openCheckout);
  Then('Alice can enter a payment method at checkout', pages.seeCheckout);
  When('Alice chooses to manage her membership', pages.openPortal);
  Then('Alice can return to the app from the billing portal', pages.seePortal);
}
