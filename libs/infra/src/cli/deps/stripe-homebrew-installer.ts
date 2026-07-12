import { Homebrew, type Installer } from '@pkgs/os';

const STRIPE_TAP = 'stripe/stripe-cli';
const STRIPE_FORMULA = 'stripe/stripe-cli/stripe';
const STRIPE_LINK_NAME = 'stripe';

/** Homebrew install path for the Stripe CLI. */
export class StripeHomebrewInstaller implements Installer {
  private readonly brew = new Homebrew();

  install(): void {
    this.requireBrew();
    this.brew.tap(STRIPE_TAP);
    this.brew.install(STRIPE_FORMULA);
    this.brew.linkOverwrite(STRIPE_LINK_NAME);
  }

  upgrade(): void {
    this.requireBrew();
    this.brew.tap(STRIPE_TAP);
    this.brew.upgrade(STRIPE_FORMULA);
    this.brew.linkOverwrite(STRIPE_LINK_NAME);
  }

  private requireBrew(): void {
    if (!this.brew.isAvailable()) {
      throw new Error('homebrew not available');
    }
  }
}
