/**
 * Pressing subscribe: mark that a checkout is under way, start it, and open
 * the provider's page. A checkout that never opened is not under way, and a
 * refusal because the account already has a membership asks the device to
 * look for it.
 */

import { billingFailureIn } from './billing-request-error';

export type OpenCheckoutDeps = {
  /** Whether a checkout is under way (it answers a hosting invitation). */
  readonly setAwaiting: (awaiting: boolean) => void;
  /** Starts a checkout; resolves to the provider page. */
  readonly start: () => Promise<string>;
  readonly open: (url: string) => Promise<void>;
  /** Fetch this person's membership again. */
  readonly refresh: () => void;
};

export async function openCheckout(deps: OpenCheckoutDeps): Promise<void> {
  deps.setAwaiting(true);
  try {
    await deps.open(await deps.start());
  } catch (error) {
    deps.setAwaiting(false);
    if (billingFailureIn(error) === 'has_membership') deps.refresh();
    throw error;
  }
}
