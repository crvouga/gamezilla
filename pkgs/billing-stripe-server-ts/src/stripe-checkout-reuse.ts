/**
 * What a Stripe checkout may hand back instead of opening another: a person
 * pays for one membership however often they press subscribe.
 */
import { paidCheckoutReturnUrl } from '@pkgs/billing-root-shared-ts/checkout-return';
import { isMembershipLive } from '@pkgs/billing-root-shared-ts/precedence';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared-ts/membership-status';
import type Stripe from 'stripe';

/**
 * An open checkout this close to expiring is not handed back: the person
 * would barely reach the card form before it closed.
 */
const CHECKOUT_REUSE_MARGIN_S = 10 * 60;

/** The subscription Stripe holds for `customer` that is live, if any. */
export async function liveStripeSubscription(
  stripe: Stripe,
  customer: string
): Promise<Record<string, unknown> | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer,
    limit: 100,
  });
  const live = subscriptions.data.find((subscription) =>
    isMembershipLive(membershipStatusOf(subscription.status))
  );
  return live === undefined ? null : { ...live };
}

/**
 * The URL of the customer's open subscription checkout for `returnUrl`, if
 * any. A checkout's success address is `returnUrl` marked as paid
 * ({@link paidCheckoutReturnUrl}), so that is the address it is matched by. Every other open checkout of theirs is expired, so only one can take a
 * payment.
 */
export async function reusableStripeCheckout(
  stripe: Stripe,
  args: {
    readonly customer: string;
    readonly returnUrl: string;
    readonly nowMs: number;
  }
): Promise<string | null> {
  const open = await stripe.checkout.sessions.list({
    customer: args.customer,
    status: 'open',
    limit: 100,
  });
  const nowS = args.nowMs / 1000;
  const successUrl = paidCheckoutReturnUrl(args.returnUrl);
  const reusable = [...open.data]
    .sort((a, b) => b.created - a.created)
    .find(
      (session) =>
        session.mode === 'subscription' &&
        session.success_url === successUrl &&
        (session.url ?? '').length > 0 &&
        session.expires_at - CHECKOUT_REUSE_MARGIN_S > nowS
    );
  for (const session of open.data) {
    if (session.id !== reusable?.id) {
      await stripe.checkout.sessions.expire(session.id);
    }
  }
  return reusable?.url ?? null;
}
