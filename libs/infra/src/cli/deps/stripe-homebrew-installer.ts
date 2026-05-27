import { Homebrew, type Installer } from '@pkgs/os';

const LEGACY_STRIPE_CLI_FORMULA = 'stripe-cli';
const STRIPE_TAP = 'stripe/stripe-cli';
const STRIPE_FORMULA = 'stripe/stripe-cli/stripe';
const STRIPE_LINK_NAME = 'stripe';

/**
 * Homebrew install path for the Stripe CLI. Goes beyond a plain `brew install`
 * because the formula was renamed (`stripe-cli` → `stripe`) and Homebrew
 * keeps the legacy formula linked; we must `unlink stripe-cli` to free the
 * `stripe` binary name, then `link --overwrite stripe` after install to take
 * over from whatever previously claimed the name.
 */
export class StripeHomebrewInstaller implements Installer {
  private readonly brew = new Homebrew();

  install(): void {
    this.requireBrew();
    this.brew.tap(STRIPE_TAP);
    this.unlinkLegacy();
    this.brew.install(STRIPE_FORMULA);
    this.brew.linkOverwrite(STRIPE_LINK_NAME);
  }

  upgrade(): void {
    this.requireBrew();
    this.brew.tap(STRIPE_TAP);
    this.unlinkLegacy();
    this.brew.upgrade(STRIPE_FORMULA);
    this.brew.linkOverwrite(STRIPE_LINK_NAME);
  }

  private requireBrew(): void {
    if (!this.brew.isAvailable()) {
      throw new Error('homebrew not available');
    }
  }

  private unlinkLegacy(): void {
    if (this.brew.isInstalled(LEGACY_STRIPE_CLI_FORMULA)) {
      this.brew.unlink(LEGACY_STRIPE_CLI_FORMULA);
    }
  }
}
