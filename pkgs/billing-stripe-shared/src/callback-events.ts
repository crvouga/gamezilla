/**
 * The Stripe events whose state we project: a subscription's, and a charge
 * refunded (the subscription it paid for). Vendor event names live only here;
 * `@libs/billing` never sees them.
 */
export const STRIPE_MEMBERSHIP_CALLBACK_EVENTS: Readonly<Record<string, true>> =
  {
    'customer.subscription.created': true,
    'customer.subscription.updated': true,
    'customer.subscription.deleted': true,
    'customer.subscription.paused': true,
    'customer.subscription.resumed': true,
    'charge.refunded': true,
    'charge.succeeded': true,
  };
